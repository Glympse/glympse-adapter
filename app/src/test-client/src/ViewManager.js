define(function(require, exports, module)
{
    'use strict';

	// Core imports
	var lib = require('glympse-adapter/lib/utils');
	var AdapterDefines = require('glympse-adapter/GlympseAdapterDefines');

	// Test app-specific
	var Defines = require('src-client/Defines');

	var c = Defines.CMD;
	var appMSG = AdapterDefines.MSG;


	// Exported class
	function ViewManager(cfg)
	{
		var dbg = lib.dbg('Client-VM', cfg.dbg);

		// state
		var controller;
		var cards;
		var invitesCard;
		var invitesGlympse;

		// ui - general
		var divLoading = $('#divLoading');
		var glympser = $('#glympser');


		///////////////////////////////////////////////////////////////////////////////
		// PUBLICS
		///////////////////////////////////////////////////////////////////////////////

		this.init = function(appController)
		{
			controller = appController;
		};

		this.cmd = function(cmd, args)
		{
			switch (cmd)
			{
				case c.InitUi:
				{
					divLoading.hide();
					doResize();

					cards = args.cards;
					invitesCard = args.invitesCard;
					invitesGlympse = args.invitesGlympse;

					dbg('Cards: ' + cards + ', invitesCard: ' + invitesCard + ', invitesGlympse: ' + invitesGlympse);

					if (!cards || cards.length === 0)
					{
						dbg('--> Glympse viewer only: ' + cfg.adapter.map.getInvites().length + ' invites');
					}

					if (invitesGlympse)
					{
						dbg('Current properties for invite "' + invitesGlympse[0] + '"', cfg.adapter.map.getInviteProperties(invitesGlympse[0]));
					}

					break;
				}

				case appMSG.StateUpdate:
				{
					//dbg('args', args);
					dbg('[' + args.invite + '/' + args.card + '] "' + args.id + '"', args.val);
					//if (invitesGlympse)
					//{
						//dbg('Current properties for invite "' + invitesGlympse[0] + '"', cfg.adapter.map.getInviteProperties(invitesGlympse[0]));
					//}
					break;
				}

				case appMSG.DataUpdate:
				{
					//dbg('args', args);
					dbg('[' + args.id + '/' + args.card + '] DATA', args.data);
					break;
				}

				case appMSG.InviteClicked:
				{
					dbg('[** InviteClicked **] - Invite: "' + args.id + '"', args);
					break;
				}

				default:
				{
					dbg('cmd() - unknown cmd: "' + cmd + '"', args);
					break;
				}
			}

			return null;
		};


		///////////////////////////////////////////////////////////////////////////
		// UTILITY
		///////////////////////////////////////////////////////////////////////////

		function doResize(forced)
		{
			if (cfg.noResize)
			{
				return;
			}

			//var w = $(window).width();
			var h = $(window).height();// - $('#hdrApp').height();

			divLoading.css({ height: $(window).height() });
			glympser.css({ height: h });
		}


		///////////////////////////////////////////////////////////////////////////
		// CALLBACKS
		///////////////////////////////////////////////////////////////////////////


		///////////////////////////////////////////////////////////////////////////
		// CTOR
		///////////////////////////////////////////////////////////////////////////

		if (!cfg.noResize)
		{
			doResize();
			$(window).resize(doResize);
		}
	}


	module.exports = ViewManager;
});
