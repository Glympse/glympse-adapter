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
					dbg('addGroup: ', args);

					if (account)
					{
						loadGroup(args);
						break;
					}

					groupsToLoad.push(args);
					break;
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

		function loadGroup(groupInfo)
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

			if (groups[name])
			{
				dbg('ERROR group "' + name + '" already loaded');
				return;
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
					return;
				}
			}

			pollGroups.push(group);
			if (pollGroups.length === 1)
			{
				timerRequest = raf.setInterval(makeGroupRequests, PG_POLL_INTERVAL);
			}
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
			// FIXME: Make this a batch call instead
			for (var i = 0, len = pollGroups.length; i < len; i++)
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
	}

	module.exports = PublicGroupController;
});
