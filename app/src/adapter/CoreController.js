define(function(require, exports, module)
{
	'use strict';

	// defines
	var lib = require('glympse-adapter/lib/utils');
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
				case rl.hasAccount:
				{
					return account.hasAccount();
				}

				case r.addGroup:
				{
					if (!groupController)
					{
						groupController = new GroupController(this, cfg);
					}

					groupController.cmd(cmd, args);
					break;
				}

				case r.removeGroup:
				case r.getGroups:
				{
					return groupController.cmd(cmd, args);
				}

				case r.getGroup:
				{
					console.log('ERROR: getGroup() interface NOT_IMPL');
					break;
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
			}
		};

		this.getAccount = function()
		{
			return account;
		};


		///////////////////////////////////////////////////////////////////////////////
		// UTILITY
		///////////////////////////////////////////////////////////////////////////////

	}

	module.exports = CoreController;
});
