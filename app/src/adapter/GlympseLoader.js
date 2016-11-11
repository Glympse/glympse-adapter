define(function(require, exports, module)
{
    'use strict';

	var lib = require('glympse-adapter/lib/utils');
	var Defines = require('glympse-adapter/GlympseAdapterDefines');
	var m = Defines.MSG;
	var s = Defines.STATE;
	var r = Defines.REQUESTS;

	// Glympse-specific
	var Account = require('glympse-adapter/adapter/models/Account');
	var GlympseInvite = require('glympse-adapter/adapter/models/GlympseInvite');


	// Exported class
	function GlympseLoader(controller, cfg)
	{
		// consts
		var dbg = lib.dbg('GlympseInvites', cfg.dbg);
		var svr = (cfg.svcGlympse || '//api.glympse.com/v2/');

		// state
		var that = this;
		var token = cfg.authToken;
		var idInvite;
		var invite;


		///////////////////////////////////////////////////////////////////////////////
		// PUBLICS
		///////////////////////////////////////////////////////////////////////////////

		this.initialized = false;

		this.init = function(inviteToLoad)
		{
			idInvite = inviteToLoad;

			if (token)
			{
				accountInitComplete(token);
			}
			this.initialized = true;
		};


		this.notify = function(msg, args)
		{
			switch (msg)
			{
				case Account.InitComplete:
				{
					token = args.token;
					accountInitComplete(token, args);
					break;
				}

				case m.InviteInit:
				{
					controller.notify(msg, args);
					break;
				}

				case m.InviteReady:
				{
					var error = args.getError();

					if (error && error.error === 'oauth_token')
					{
						if (error.error_detail.indexOf('expired') >= 0)
						{
							account.handleExpiredToken();
						}
						else
						{
							account.handleInvalidToken();
						}

						break;
					}

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


		///////////////////////////////////////////////////////////////////////////////
		// UTILITY
		///////////////////////////////////////////////////////////////////////////////

		function accountInitComplete(token, info)
		{
			if (!token)
			{
				dbg('Error during Account.Init()', info);
				return;
			}

			//dbg('Auth token: ' + account.getToken() + ' -- ' + (info && info.token));
			dbg('[' + ((cfg.anon) ? 'ANON' : 'ACCT') + '] Token active. Loading Glympse invite "' + idInvite + '"');

			if (!invite)
			{
				invite = new GlympseInvite(that, idInvite, token, cfg);
			}

			invite.load();
		}
	}


	module.exports = GlympseLoader;
});
