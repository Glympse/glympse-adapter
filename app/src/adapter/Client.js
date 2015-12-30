// App entry point
define(function(require, exports, module)
{
    'use strict';

	// imports
	var lib = require('glympse-adapter/lib/utils');
	var Oasis = require('oasis');
	var Defines = require('glympse-adapter/GlympseAdapterDefines');
	var ViewerMonitor = require('glympse-adapter/adapter/ViewerMonitor');
	var CardsController = require('glympse-adapter/adapter/CardsController');
	var GlympseLoader = require('glympse-adapter/adapter/GlympseLoader');

	var s = Defines.STATE;
	var m = Defines.MSG;
	var mStateUpdate = m.StateUpdate;	// Used alot


	function Client(controller, oasisLocal, app, cfg, elementViewer)
	{
		var cfgApp = (cfg && cfg.app) || {};
		var cfgAdapter = (cfg && cfg.adapter) || {};
		var cfgViewer = (cfg && cfg.viewer) || {};

		var dbg = lib.dbg('Client', cfgApp.dbg);

		// state
		var cardsController;
		var cfgMonitor = { dbg: cfgApp.dbg, viewer: elementViewer };
		var invitesCard;
		var invitesGlympse;
		var invitesReferences = { };
		var glympseLoader;
		var mapCardInvites = { };
		var viewerMonitor;

		var progressCurrent = 0;
		var progressTotal = 0;

		var connectedOasis = false;
		var connectQueue = [];
		var port;

		cfgAdapter.dbg = cfgApp.dbg || cfgAdapter.dbg;
		cfgViewer.services = cfgAdapter.svcGlympse; // Link viewer to card data center


		///////////////////////////////////////////////////////////////////////////////
		// PROPERTIES
		///////////////////////////////////////////////////////////////////////////////

		this.getViewer = function()
		{
			return viewerMonitor.getViewer();
		};

		///////////////////////////////////////////////////////////////////////////////
		// PUBLICS
		///////////////////////////////////////////////////////////////////////////////

		this.init = function(settings)
		{
			var card = cfgAdapter.card;
			var t = cfgAdapter.t;
			var pg = cfgAdapter.pg;
			var twt = cfgAdapter.twt;
			var g = cfgAdapter.g;

			var cfgClient = { consumers: { } };
			var events = { };
			var requests = { };

			var cleanInvites = lib.cleanInvites;

			invitesCard = (card) ? cleanInvites([ card ]) : [];
			invitesGlympse = cleanInvites(splitMulti(t));

			events.setUserInfo = setUserInfo;	// Dummy/test

			$.extend(settings, { invitesCard: invitesCard, invitesGlympse: invitesGlympse });

			viewerMonitor = new ViewerMonitor(this, cfgMonitor);
			cardsController = new CardsController(this, cfgAdapter);

			// API namespaced endpoints
			var svcs = [ { id: 'MAP', targ: viewerMonitor },
						 { id: 'CARDS', targ: cardsController}
					   ];

			var intInterfaces = { map: { getInviteProperties: getInviteProperties
									   , getInviteProperty: getInviteProperty
									   }
								, cards: {}
								};

			// Defines.SVC_ID.REQUESTS specifies the various API endpoints
			// to expose to both client and host consumers:
			// Client APIs --> adapter_instance.SVC_ID.*()
			// Host calls --> interfaces.SVC_ID.*
			for (var i = 0, len = svcs.length; i < len; i++)
			{
				var id, aid = svcs[i];
				var idApi = aid.id.toLowerCase();
				var listApis = [];

				requests[idApi] = generateRequestAction(aid.targ);

				// Generate public APIs from static internal interfaces
				var targ = intInterfaces[idApi];
				for (id in targ)
				{
					listApis.push(id); // Advertised host availability
					controller[idApi][id] = targ[id]; // Local client access
				}

				// Generic "action" APIs to pass along to hosted object
				targ = Defines[aid.id].REQUESTS;
				for (id in targ)
				{
					listApis.push(id); // Advertised host availability
					controller[idApi][id] = generateTargAction(aid.targ, id);	// Local client access
				}

				// Add local-only requests, err, locally
				targ = Defines[aid.id].REQUESTS_LOCAL;
				for (id in targ)
				{
					controller[idApi][id] = generateTargAction(aid.targ, id);	// Local client access (only)
				}

				settings[idApi] = listApis;
			}

			// Add user-defined interfaces, if specified
			var customInterfaces = cfgAdapter.interfaces;
			if (customInterfaces)
			{
				var extInterfaces = [];
				for (id in customInterfaces)
				{
					extInterfaces.push(id);
					controller.ext[id] = customInterfaces[id];
				}

				settings.ext = extInterfaces;
			}

			connectQueue.push({ id: 'Connected', val: settings });

			cfgClient.consumers[Defines.PORT] = Oasis.Consumer.extend(
			{
				initialize: oasisInitialize,
				events: events,		// send data/notification --> necessary?
				requests: requests	// request data
			});

			oasisLocal.connect(cfgClient);

			var initSettings = { isCard: (card != null)
							   , t: invitesGlympse
							   , pg: splitMulti(pg)
							   , twt: splitMulti(twt)
							   , g: splitMulti(g)
							   };

			progressCurrent = 0;
			progressTotal = (card) ? (5 + 1 * 2) : 3;
			sendEvent(m.AdapterInit, initSettings);
			updateProgress();


			// Card vs Glympse Invite loading
			if (invitesCard.length > 0)
			{
				cardsController.init(invitesCard);
			}
			else if (lib.simplifyInvite(t).indexOf('demobot') < 0)
			{
				glympseLoader = new GlympseLoader(this, cfgAdapter);
				glympseLoader.init(t);	// FIXME: Assumes only one invite code!
			}
			else if (t || pg || g || twt)
			{
				// Straight glympse invites/references to load
				cfgViewer.t = t;
				cfgViewer.pg = pg;
				cfgViewer.twt = twt;
				cfgViewer.g = g;

				this.loadViewer(cfgViewer);
			}
		};

		this.loadViewer = function(cfgNew)
		{
			// Signal the cards/invites to load
			sendEvent(m.AdapterReady, { cards: invitesCard, glympses: invitesGlympse });

			//console.log('cfg.viewer=' + cfgMonitor.viewer);
			$.extend(cfgViewer, cfgNew);
			viewerMonitor.run();
			$(cfgMonitor.viewer).glympser(cfgViewer);
		};

		this.infoUpdate = function(id, invite, owner, t, val)
		{
			var info = { id: id
					   , invite: invite
					   , owner: owner
					   , card: mapCardInvites[invite]
					   , t: t
					   , val: val
					   };

			notifyApp(mStateUpdate, info, false);
			sendOasisMessage(mStateUpdate, info);
		};

		this.notify = function(msg, args)
		{
			var idCard;

			switch (msg)
			{
				case m.CardInit:
				case m.CardReady:
				case m.CardsInitStart:
				case m.InviteInit:
				case m.ViewerInit:
				{
					updateProgress();
					sendEvent(msg, args);
					break;
				}

				case m.ViewerReady:
				{
					// Break ViewReady out to hand off viewer app reference for local
					// consumers only. Hosted consumers will only get a notification.
					updateProgress();
					sendOasisMessage(msg, true);
					notifyApp(msg, args, true);
					break;
				}

				case m.CardsInitEnd:
				{
					sendEvent(msg, args);
					invitesGlympse = [];

					for (var i = 0, cards = args, len = cards.length; i < len; i++)
					{
						var card = cards[i];
						idCard = card.getIdCard();

						if (!card.isLoaded())
						{
							// If card failed to load properly, fallback to the
							// original Glympse invite to render last-known state
							var reference = invitesReferences[idCard];
							var idx = invitesCard.indexOf(idCard);
							console.log('Error loading card "' + idCard + '" ---> reference: ' + reference + ', idx=' + idx);
							if (reference)
							{
								invitesGlympse.push(reference);
							}

							if (idx >= 0)
							{
								invitesCard.splice(idx, 1);
							}

							continue;
						}

						var members = card.getMembers();
						//console.log('[' + i + ']: ' + card.getName() + ' with ' + members.length + ' members');
						for (var j = 0, mlen = members.length; j < mlen; j++)
						{
							var member = members[j];
							var invite = member.getTicket().getInviteCode();
							//console.log('  [' + j + ']: ' + invite);
							if (invite)
							{
								invitesGlympse.push(invite);
								mapCardInvites[invite] = idCard;
							}
						}
					}

					//dbg('Card map', mapCardInvites);

					// Real cards/invites to be loaded
					if (invitesGlympse.length > 0)
					{
						//console.log('---> Loading invites: ' + invitesGlympse);
						cfgViewer.t = invitesGlympse.join(';');
						this.loadViewer(cfgViewer);
					}

					break;
				}

				case m.InviteError:
				{
					//dbg('Invite loading error', args);
					sendEvent(msg, args);
					break;
				}

				case m.InviteReady:
				{
					if (!args.isLoaded())
					{
						dbg('Invite error state', args.getError());
						sendEvent(m.InviteError, args);
					//	return null;
					}

					dbg('InviteReady: ' + args.getIdInvite() + ' -- isLoaded=' + args.isLoaded());
					sendEvent(msg, args);

					idCard = args.getReference();
					//dbg('Has reference: "' + idCard + '"');
					if (idCard)
					{
						if (invitesCard.indexOf(idCard) < 0)
						{
							// Track back in case of expired card invite
							invitesReferences[idCard] = args.getIdInvite();

							progressTotal += (5 + 1 * 2) - 2;
							invitesCard.push(idCard);
							sendEvent(m.AdapterInit, { isCard: true });
							updateProgress();
							cardsController.init(invitesCard);
						}
					}
					else
					{
						// Use the original invite list
						progressTotal += (3 - 1);
						updateProgress();
						cfgViewer.t = args.getIdInvite();	// FIXME: Breaks for multiple initial invites

						this.loadViewer(cfgViewer);
					}

					break;
				}

				case m.DataUpdate:
				case m.InviteAdded:
				case m.InviteRemoved:
				{
					args.card = mapCardInvites[args.id];
					sendEvent(msg, args);
					//dbg(msg, args);//(msg === m.DataUpdate) ? args : undefined);
					break;
				}

				default:
				{
					dbg('notify(): unknown msg: "' + msg + '"', args);
					break;
				}
			}

			return null;
		};


		///////////////////////////////////////////////////////////////////////////////
		// INTERNAL
		///////////////////////////////////////////////////////////////////////////////

		function splitMulti(val)
		{
			return (val && val.split(';'));
		}

		function joinMulti(val)
		{
			return (val && val.split(';'));
		}

		function generateTargAction(targ, id)
		{
			return function(data)
			{
				return (targ.cmd(id, data) || true);
			};
		}

		function generateRequestAction(targ)
		{
			return function(data)
			{
				return (targ.cmd(data.id, data.args) || true);
			};
		}

		function updateProgress()
		{
			sendEvent(m.Progress,
					 { curr: Math.min(++progressCurrent, progressTotal)
					 , total: progressTotal
					 });
		}

		function notifyApp(msg, args, evtMsg)
		{
			if ((!evtMsg && cfgAdapter.hideUpdates) || (evtMsg && cfgAdapter.hideEvents))
			{
				return;
			}

			app.notify(msg, args);
		}

		function sendEvent(msg, args)
		{
			sendOasisMessage(msg, args);
			notifyApp(msg, args, true);
		}


		///////////////////////////////////////////////////////////////////////////////
		// CLIENT-MODE OASIS HANDLERS
		///////////////////////////////////////////////////////////////////////////////

		// Once the port is initialized, send along the "Connect" command to the host
		function oasisInitialize(newPort, name)
		{
			dbg('**** Consumer Init **** q=' + connectQueue.length);

			port = newPort;
			connectedOasis = true;

			for (var i = 0, len = connectQueue.length; i < len; i++)
			{
				var q = connectQueue[i];
				//dbg('Sending: ' + q.id);
				this.send(q.id, q.val);
			}

			connectQueue = [];

			var extInit = cfgAdapter.initialize;
			if (extInit)
			{
				extInit(name);
			}
		}

		function sendOasisMessage(id, val)
		{
			if (connectedOasis)
			{
				//dbg('send "' + id + '" ', val);
				port.send(id, (val && val.toJSON && val.toJSON()) || val);
			}
			else
			{
				connectQueue.push({ id: id, val: val });
			}
		}


		///////////////////////////////////////////////////////////////////////////////
		// HOST REQUEST HANDLERS (MAP)
		///////////////////////////////////////////////////////////////////////////////

		function getInviteProperties(idInvite)
		{
			if (!viewerMonitor)
			{
				return 'NOT_INITIALIZED';
			}

			return viewerMonitor.getCurrentProperties(idInvite);
		}

		// cfgInvite = { idProperty: name_of_property_to_retrieve
		//			   , idInvite:   glympse_invite_id --> can be null if first invite is targetted
		//			   }
		function getInviteProperty(cfgInvite)
		{
			if (!viewerMonitor)
			{
				return 'NOT_INITIALIZED';
			}

			return viewerMonitor.getCurrentValue(cfgInvite.idProperty, cfgInvite.idInvite);
		}

/*		function requestPing(str)
		{
			return new Oasis.RSVP.Promise(function(resolve, reject)
			{
				var delay = 100;
				setTimeout(function()
				{
					resolve('PONG - ' + str + ' (delayed ' + delay + 'ms)');
				}, delay);
			});
		}*/


		///////////////////////////////////////////////////////////////////////////////
		// HOST EVENT HANDLERS
		///////////////////////////////////////////////////////////////////////////////

		function setUserInfo(data)
		{
			dbg('setUserInfo', data);
		}
	}


	module.exports = Client;
});
