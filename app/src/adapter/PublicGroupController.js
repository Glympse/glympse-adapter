define(function(require, exports, module)
{
	'use strict';

	// defines
	var lib = require('glympse-adapter/lib/utils');
	var raf = require('glympse-adapter/lib/rafUtils');
	var Defines = require('glympse-adapter/GlympseAdapterDefines');
	var PublicGroup = require('glympse-adapter/adapter/models/PublicGroup');

	var m = Defines.MSG;
	var rl = Defines.CORE.REQUESTS_LOCAL;

	// Exported class
	function PublicGroupController(controller, cfg)
	{
		// consts
		var dbg = lib.dbg('PublicGroupController', cfg.dbg);

		var PG_POLL_INTERVAL = 15000;

		// state
		var initialized = false;
		var account = cfg.account;
		var noPolling = false;
		var pollingInterval;

		var groupName;
		var groupRaw;
		var publicGroup;

		var that = this;

		///////////////////////////////////////////////////////////////////////////////
		// PUBLICS
		///////////////////////////////////////////////////////////////////////////////

		this.init = function(pg)
		{
			if (typeof pg === 'string')
			{
				// load from scratch
				groupName = pg;
			}
			else
			{
				// given the initial group header
				groupName = pg.name;
				groupRaw = pg;
			}

			initialized = true;

			if (account)
			{
				accountInitComplete();
			}
		};

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

				case m.PG_Loaded:
				{
					controller.notify(msg, args);
					break;
				}
				case m.PG_RequestStatus:
				{
					// schedule next update
					if (!noPolling)
					{
						if (pollingInterval)
						{
							raf.clearInterval(pollingInterval);
						}
						pollingInterval = raf.setTimeout(function()
						{
							publicGroup.request();
						}, PG_POLL_INTERVAL);
					}

					//TODO: add/remove invites to/from the viewer
					var toAdd = publicGroup.getTicketGroup();
					var toRemove = publicGroup.getInviteRemove();

					if (toAdd.length || toRemove.length)
					{
						console.warn('>>> added/removed', toAdd, toRemove);
					}

					// notify parent ctrl
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
				//TODO: get orgs cmd probably can be here (FE-852)
				default:
					dbg('method not found', cmd);
			}
		};


		///////////////////////////////////////////////////////////////////////////////
		// UTILITY
		///////////////////////////////////////////////////////////////////////////////

		function loadPublicGroup()
		{
			publicGroup = new PublicGroup(that, account, groupName, cfg);
			if (groupRaw)
			{
				publicGroup.setData(groupRaw);
				groupRaw = null;
			}
			noPolling = publicGroup.request();
		}

		function accountInitComplete(args)
		{
			var sig = '[PublicGroup#accountInitComplete] - ';

			if (!account)
			{
				dbg(sig + 'authToken unavailable', args);
				return;
			}

			if (!initialized)
			{
				dbg(sig + 'not initialized', args);
				return;
			}

			// Now load the group
			loadPublicGroup();
		}

		function accountDeleteComplete()
		{
			account = null;
			if (pollingInterval)
			{
				raf.clearInterval(pollingInterval);
				pollingInterval = null;
			}
		}
	}

	module.exports = PublicGroupController;
});
