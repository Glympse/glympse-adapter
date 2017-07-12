define(function(require, exports, module)
{
	'use strict';

	// defines
	var lib = require('glympse-adapter/lib/utils');
	var raf = require('glympse-adapter/lib/rafUtils');
	var ajax = require('glympse-adapter/lib/ajax');
	var Defines = require('glympse-adapter/GlympseAdapterDefines');
	var PublicGroup = require('glympse-adapter/adapter/models/PublicGroup');

	var m = Defines.MSG;
	var r = Defines.CORE.REQUESTS;
	var rl = Defines.CORE.REQUESTS_LOCAL;

	// Exported class
	function PublicGroupController(controller, cfg)
	{
		// consts
		var dbg = lib.dbg('PublicGroupController', cfg.dbg);
		var svr = cfg.svcEnRoute;

		var cDemoOrgObjects = {};

		var PG_POLL_INTERVAL = 15000;

		// state
		var account = cfg.account;
		var timerRequest;

		var groups = {};
		var groupsToLoad = [];
		var pollGroups = [];

		var that = this;


		///////////////////////////////////////////////////////////////////////////////
		// PUBLICS
		///////////////////////////////////////////////////////////////////////////////

		this.notify = function(msg, args)
		{
			switch (msg)
			{
				case m.AccountLoginStatus:
				{
					account = args.account;
					accountInitComplete(args);
					break;
				}

				case m.AccountDeleteStatus:
				{
					accountDeleteComplete();
					break;
				}

				case m.GroupLoaded:
				case m.GroupStatus:
				{
					controller.notify(msg, args);
					break;
				}

				default:
				{
					dbg('Unknown msg: "' + msg + '"', args);
					break;
				}
			}

			return null;
		};

		this.cmd = function(cmd, args)
		{
			switch (cmd)
			{
				case r.addGroup:
				{
					if (account)
					{
						return loadGroup(args);
					}

					groupsToLoad.push(args);
					return loadGroup(args, true);
				}

				case r.removeGroup:
				{
					// args: { name: groupname_to_remove, removeInvites: true|false }

					var invites;
					var groupName = ((args && args.name) || '').toLowerCase();
					var status = (groupName && groups.hasOwnProperty(groupName));
					var removeInvites = (status && args.removeInvites) || undefined;

					if (status)
					{
						for (var i = pollGroups.length - 1; i >= 0; i--)
						{
							if (pollGroups[i].getName() === groupName)
							{
								pollGroups.splice(i, 1);
								break;
							}
						}

						invites = groups[groupName].getInvites();

						// Optionally remove invites from the map as well
						if (removeInvites)
						{
							// Need to ensure this callback occurs *after* the current thread of execution completes
							raf.setTimeout(function()
							{
								controller.notify(Defines.MAP.REQUESTS.removeInvites, invites.join(';'));
							}, 10);
						}

						delete groups[groupName];
						if (timerRequest && pollGroups.length === 0)
						{
							raf.clearInterval(timerRequest);
							timerRequest = null;
						}
					}

					return { status: status, group: groupName, invites: invites, removingInvites: removeInvites };
				}

				case r.getGroups:
				{
					var arr = [];
					var argsArr;

					// Ensure we are comparing to all lower-cased group names
					if (Array.isArray(args))
					{
						argsArr = []
						for (var i = args.length - 1; i >= 0; i--)
						{
							if (args[i])
							{
								argsArr.push(args[i].toLowerCase());
							}
						}
					}

					for (var key in groups)
					{
						if (groups.hasOwnProperty(key) &&
						   (!args || (typeof args === 'string' && args.toLowerCase() === key) || (argsArr && argsArr.indexOf(key) >= 0))
						   )
						{
							arr.push(groups[key].toJSON());
						}
					}

					return arr;
				}

				case r.getOrgObjects:
				{
					getOrgObjects(args);
					break;
				}

				default:
				{
					dbg('Unknown cmd: "' + cmd + '" - ', args);
					break;
				}
			}
		};


		///////////////////////////////////////////////////////////////////////////////
		// UTILITY
		///////////////////////////////////////////////////////////////////////////////

		function loadGroup(groupInfo, validate)
		{
			var name;
			var header;

			if (typeof groupInfo === 'string')
			{
				// load from scratch
				name = groupInfo;
			}
			else
			{
				// given the initial group header
				name = groupInfo.name;
				header = groupInfo;
			}

			if (!name)
			{
				dbg('ERROR no group name defined');
				return false;
			}

			name = name.toLowerCase();

			if (groups[name])
			{
				dbg('ERROR group "' + name + '" already loaded');
				return false;
			}

			if (validate)
			{
				return true;
			}

			var group = new PublicGroup(that, account, name, cfg);

			groups[name] = group;

			// Initial group with a header = real group
			if (header)
			{
				group.setData(header);
			}
			else
			{
				if (group.request())
				{
					return true;
				}
			}

			pollGroups.push(group);

			if (!timerRequest)
			{
				timerRequest = raf.setInterval(makeGroupRequests, PG_POLL_INTERVAL);
			}

			return true;
		}

		/**
		 * Fetch org objects
		 * @param {Object} reqParams
		 * @param {number} reqParams.orgId
		 * @param {string} [reqParams.objType]
		 */
		function getOrgObjects(reqParams)
		{
			if (!reqParams || !reqParams.orgId)
			{
				var error = '"orgId" request param must be specified!';

				dbg(error, reqParams, 3);

				controller.notify(m.OrgObjects, {
					status: false,
					error: error
				});

				return;
			}

			var demoObjects = cDemoOrgObjects[reqParams.orgId];
			if (demoObjects)
			{
				controller.notify(m.OrgObjects, demoObjects);
				return;
			}

			var url = svr + 'org/' + reqParams.orgId + '/objects';
			var data;

			if (reqParams.objType)
			{
				data = { type: encodeURIComponent(reqParams.objType) };
			}

			ajax.get(url, data, { account: account, useGlympseAuthHeader: true })
				.then(function(result)
				{
					controller.notify(m.OrgObjects, result);
				});
		}

		function makeGroupRequests()
		{
			var len = pollGroups.length;

			if (len === 0 && timerRequest)
			{
				raf.clearInterval(timerRequest);
				timerRequest = null;
				return;
			}

			// FIXME: Make this a batch call instead
			for (var i = 0; i < len; i++)
			{
				pollGroups[i].request();
			}
		}

		function accountInitComplete(args)
		{
			if (!account)
			{
				dbg('[accountInitComplete] - authToken unavailable', args);
				return;
			}

			// Load any pending groups
			for (var i = 0, len = groupsToLoad.length; i < len; i++)
			{
				loadGroup(groupsToLoad[i]);
			}

			groupsToLoad = [];
		}

		function accountDeleteComplete()
		{
			account = null;
			if (timerRequest)
			{
				raf.clearInterval(timerRequest);
				timerRequest = null;
			}
		}

		cDemoOrgObjects[-999] = {
			status: true,
			response: [
				{
					hierarchy: [],
					org_id: -999,
					//TODO: does it make sense to generate waypoints based on passed `appCfg.areaDestinations`?
					// smth like `appCfg.areaDestinations.slice(0).reverse()`
					// Last location is base (at least for now)
					waypoints: [
						{ name: 'LAX Terminal #1', lat: 33.9451076, lng: -118.4032515 }
						, { name: 'LAX Terminal #3 Lower Level FlyAway Stop', lat: 33.9438901, lng: -118.4060479 }
						, { name: 'LAX Terminal #5 Lower Level FlyAway Stop', lat: 33.9426841, lng: -118.4046578 }
						, { name: 'Holiday Inn Los Angeles Gateway - Torrance, 19800 S Vermont Ave, Torrance, CA 90502, USA', lat: 33.8507901, lng: -118.306608 }
					],
					last_modified_by: 0,
					group_name: 'demoshuttle',
					access: 'public',
					last_modified: 1498017300352,
					created_time: 1498017215788,
					creator_agent_id: 0,
					_id: 2,
					type: 'route'
				}
			],
			time: Date.now()
		};
	}

	module.exports = PublicGroupController;
});
