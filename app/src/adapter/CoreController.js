define(function(require, exports, module)
{
	'use strict';

	// defines
	var lib = require('glympse-adapter/lib/utils');
	var ajax = require('glympse-adapter/lib/ajax');
	var Defines = require('glympse-adapter/GlympseAdapterDefines');

	var m = Defines.MSG;
	var r = Defines.CORE.REQUESTS;
	var rl = Defines.CORE.REQUESTS_LOCAL;

	var Account = require('glympse-adapter/adapter/models/Account');
	var GroupController = require('glympse-adapter/adapter/PublicGroupController');


	// Exported class
	function CoreController(controller, cfg)
	{
		// consts
		var dbg = lib.dbg('CoreController', cfg.dbg);

		var svr = cfg.svcGlympse;

		// state
		var account = new Account(this, cfg);
		var groupController;


		///////////////////////////////////////////////////////////////////////////////
		// PUBLICS
		///////////////////////////////////////////////////////////////////////////////

		this.init = function()
		{
			account.init();
		};

		this.notify = function(msg, args)
		{
			switch (msg)
			{
				case m.AccountLoginStatus:
				{
					if (args.status && groupController)
					{
						groupController.notify(msg, args);
					}

					controller.notify(msg, args);
					break;
				}

				case m.AccountDeleteStatus:
				{
					if (groupController)
					{
						groupController.notify(msg, args);
					}

					controller.notify(msg, args);
					break;
				}

				case m.AccountCreateStatus:
				case m.UserNameUpdateStatus:
				case m.UserAvatarUpdateStatus:
				case m.UserInfoStatus:
				case m.CreateRequestStatus:
				case m.GroupLoaded:
				case m.GroupStatus:
				case m.OrgObjects:
				{
					controller.notify(msg, args);
					break;
				}

				// FIXME: Generalize this in the default handler
				case Defines.MAP.REQUESTS.removeInvites:
				{
					var mapSvc = controller.getService('map');
					if (mapSvc)
					{
						return mapSvc.cmd(msg, args);
					}

					break;
				}

				default:
				{
					dbg('Unknown msg: "' + msg + '"', args);
					break;
				}
			}
		};

		this.cmd = function(cmd, args)
		{
			switch (cmd)
			{
				case rl.hasAccount:
				{
					return account.hasAccount();
				}

				case r.addGroup:
				case r.getGroups:
				case r.removeGroup:
				{
					if (!groupController)
					{
						groupController = new GroupController(this, cfg);
					}

					return groupController.cmd(cmd, args);
				}

				case r.getOrgObjects:
				{
					groupController.cmd(cmd, args);
					break;
				}

				case rl.accountCreate:
				{
					account.create();
					break;
				}

				case rl.generateAuthToken:
				{
					account.generateToken();
					break;
				}

				case rl.setUserName:
				{
					account.setName(args);
					break;
				}

				case rl.setUserAvatar:
				{
					account.setAvatar(args);
					break;
				}

				case rl.getUserInfo:
				{
					account.getUserInfo(args);
					break;
				}

				case rl.createRequest:
				{
					account.createRequest(args);
					break;
				}

				case rl.accountDelete:
				{
					account.delete();
					break;
				}

				case r.getETAInfo:
				{
					getETAInfo(args);
					break;
				}
			}
		};

		this.getAccount = function()
		{
			return account;
		};


		///////////////////////////////////////////////////////////////////////////////
		// UTILITY
		///////////////////////////////////////////////////////////////////////////////

		/**
		 * Fetch ETA information to the given points
		 *
		 * @param {Object[]} routes - array of routes for which to calculate ETAs.
		 *	Each object must has the following properties:
		 *	- "start" - is a starting point in format { lat: number, lng: number }
		 *	- "end" - is an ending point in format { lat: number, lng: number }
		 */
		function getETAInfo(routes)
		{
			if (!routes || !routes.length)
			{
				dbg('ETA Info: no routes provided, nothing to calculate');

				controller.notify(m.ETAInfo, {
					status: true,
					result: []
				});

				return;
			}

			var routeUrl = 'maps/route?';
			var requests = [];
			var route, start, end, params;

			for (var i = 0, len = routes.length; i < len; i++)
			{
				route = routes[i];
				start = route.start;
				end = route.end;
				params = {
					start: start.lat + ',' + start.lng,
					end: end.lat + ',' + end.lng,
					fields: 'summary'
				};
				requests.push({
					method: 'GET',
					url: routeUrl + $.param(params)
				});
			}

			ajax.batch(svr + 'batch', requests, account)
				.then(function(responses)
				{
					var result = [];
					var res, eta;
					for (var i = 0, len = responses.length; i < len; i++)
					{
						res = (responses[i] || {}).result;
						eta = null;

						if (res.status)
						{
							eta = (((res.response || {}).summary || {}).travel_time || 0);
						}

						result.push(eta);
					}

					dbg('> ETA results:', result);

					controller.notify(m.ETAInfo, result);
				});
		}

	}

	module.exports = CoreController;
});
