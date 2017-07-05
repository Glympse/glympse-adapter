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
	var CoreController = require('glympse-adapter/adapter/CoreController');
	var GlympseLoader = require('glympse-adapter/adapter/GlympseLoader');
	var Account = require('glympse-adapter/adapter/models/Account');

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
		var that = this;
		var cardsController;
		var cfgMonitor = { dbg: cfgApp.dbg, viewer: elementViewer };
		var invitesCard;
		var invitesTicket;
		var invitesReferences = {};
		var glympseLoader;
		var mapCardTicketInvites = {};
		var cardsInitialized = false;
		var viewerMonitor;
		var coreController;
		// var authToken;
		var account;

		var progressCurrent = 0;
		var progressTotal = 0;

		var connectedOasis = false;
		var connectQueue = [];
		var connectQueueMaxSize = (cfgAdapter.hostQueueMaxSize !== undefined) ? cfgAdapter.hostQueueMaxSize : -1;
		var connectQueueEnabled = (connectQueueMaxSize !== 0);

		var port;
		var cardsMode = cfgAdapter.cardsMode;
		var publishedConfig = {};

		var initialized = false;
		var apiKey = cfgAdapter.apiKey || 'nXQ44D38OdVzEC34';	// sand/prod: application/79 --> prod org 20715 or 24778


		cfgAdapter.apiKey = apiKey;
		cfgAdapter.dbg = cfgApp.dbg || cfgAdapter.dbg;
		cfgAdapter.svcGlympse = (cfgAdapter.svcGlympse || ('https://api.' + ((cfgAdapter.sandbox) ? 'sandbox.' : '') + 'glympse.com/v2/'));

		// Sync up viewer settings
		cfgViewer.apiKey = apiKey;
		cfgViewer.services = cfgAdapter.svcGlympse;


		///////////////////////////////////////////////////////////////////////////////
		// PROPERTIES
		///////////////////////////////////////////////////////////////////////////////

		// Disabled for now.. all through front-door.
		// Add to MAP.REQUESTS_LOCAL for additional client-only interfaces
		//this.getViewer = function()
		//{
		//	return viewerMonitor.getViewer();
		//};


		///////////////////////////////////////////////////////////////////////////////
		// PUBLICS
		///////////////////////////////////////////////////////////////////////////////

		/**
		 * Set up the client portion of the adapter
		 * @param settings Object to advertise to any connecting adapter running in host-mode. This object is updated with all of the available interfaces/end-points.
		 */
		this.init = function(settings)
		{
			var card = cfgAdapter.card;
			var t = cfgAdapter.t;

			var cfgClient = { consumers: {} };
			var events = {};
			var requests = {};

			var cleanInvites = lib.cleanInvites;

			invitesCard = (card) ? cleanInvites([ card ]) : [];
			invitesTicket = cleanInvites(splitMulti(t));

			events.setUserInfo = setUserInfo;	// Dummy/test

			$.extend(settings, { invitesCard: invitesCard, invitesGlympse: invitesTicket });


			coreController = new CoreController(this, cfgAdapter);
			cardsController = new CardsController(this, cfgAdapter);
			viewerMonitor = new ViewerMonitor(this, cfgMonitor);

			// API namespaced endpoints
			var svcs = [
				{ id: 'MAP', targ: viewerMonitor },
				{ id: 'CARDS', targ: cardsController },
				{ id: 'CORE', targ: coreController }
			];

			var intInterfaces = { map: {}, cards: {}, core: {}, app: {} };

			intInterfaces.app.getConfig = getConfig;

			// FIXME: This shouldn't go here
			intInterfaces.map[ViewerMonitor.GetInviteProperties] = getInviteProperties;
			intInterfaces.map[ViewerMonitor.GetInviteProperty] = getInviteProperty;

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
				requests.ext = function(data)
				{
					return customInterfaces[data.id](data.args);
				};

				var extInterfaces = [];
				for (id in customInterfaces)
				{
					extInterfaces.push(id);
					controller.ext[id] = customInterfaces[id];
				}

				settings.ext = extInterfaces;
			}

			// Add local app interfaces
			var appMethods = {
				getConfig: getConfig
			};

			requests.app = function(data)
			{
				return appMethods[data.id](data.args);
			};

			settings.app = [];
			for (id in appMethods)
			{
				settings.app.push(id);
				controller.app[id] = appMethods[id];
			}

			// Set up the publishable config
			var extViewerCfg = lib.generateClone(cfgViewer);
			delete extViewerCfg['apiKey'];	// Delete sensitive info
			publishedConfig = { viewer: extViewerCfg, published: lib.generateClone(cfg.published) };

			// On connect, advertise interfaces + publishable config settings
			connectQueue.push({ id: 'Connected', val: $.extend({}, settings, { cfg: publishedConfig }) });

			cfgClient.consumers[Defines.PORT] = Oasis.Consumer.extend(
				{
					initialize: oasisInitialize,
					events: events,		// send data/notification --> necessary?
					requests: requests	// request data
				});

			oasisLocal.connect(cfgClient);

			// Notify of invite loading status
			var pg = (cfgAdapter.pg || '');
			var obj = (cfgAdapter.object || {});
			var initSettings = {
				isCard: (card !== null || cardsMode)
				, t: invitesTicket
				, pg: splitMulti(pg + ((obj.group) ? (((pg) ? ';' : '') + obj.group) : ''))
				, twt: splitMulti(cfgAdapter.twt)
				, g: splitMulti(cfgAdapter.g)
			};

			progressCurrent = 0;
			progressTotal = (invitesCard.length > 0) ? (5 + 1 * 2) :
							((invitesTicket.length > 0) ? 3 : 0);

			sendEvent(m.AdapterInit, initSettings);
			updateProgress();

			// Start up CoreController first to get current/new auth token
			dbg('Init core..');
			coreController.init();
		};

		this.loadViewer = function(cfgNew, newMapElement)
		{
			loadMap(cfgNew, newMapElement);
		};

		this.infoUpdate = function(id, invite, owner, t, val)
		{
			invite = lib.normalizeInvite(invite);

			var targetCards = mapCardTicketInvites[invite] || [];
			var info, i;
			var targetCardsLength = targetCards.length;
			// send event for each card (same user can share same inviteCode to different cards)
			for (i = (targetCardsLength) ? targetCardsLength - 1 : 0; i >= 0; i--)
			{
				info = {
					id: id
					, invite: invite
					, owner: owner
					, card: targetCards[i]
					, t: t
					, val: val
				};

				notifyApp(mStateUpdate, info, false);
				sendOasisMessage(mStateUpdate, info);
			}
		};

		this.notify = function(msg, args)
		{
			var i, idx, idCard, targetCards;

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
					break;
				}

				case m.CardUpdated:
					// dbg('card updated', args);

					switch (args.action)
					{
						case 'invite_code_found':
						case 'member_started_sharing':
						{
							var ticketInvite = args.invite;
							if (!mapCardTicketInvites[ticketInvite])
							{
								mapCardTicketInvites[ticketInvite] = [];
							}

							// Track ticket invite for this card. Need to handlecases where
							// the same invite is used by a member in multiple cards (like bots)
							idCard = args.card.getId();
							if (mapCardTicketInvites[ticketInvite].indexOf(idCard) < 0)
							{
								mapCardTicketInvites[ticketInvite].push(idCard);
							}

							break;
						}

						case 'member_stopped_sharing':
						{
							//Need to send s.InviteEnd and s.InviteCompleted events
							this.infoUpdate(s.InviteEnd, args.invite, args.userId, args.t, args.t);
							this.infoUpdate(s.InviteCompleted, args.invite, args.userId, args.t, true);

							var inviteCards = mapCardTicketInvites[args.invite];
							if (inviteCards)
							{
								idx = inviteCards.indexOf(args.card.getId());
								if (idx >= 0)
								{
									inviteCards.splice(idx, 1);
								}
							}
						}
					}

					sendEvent(msg, args);
					break;

				case m.InviteError:
				{
					//dbg('Invite loading error', args);
					if (args.data.invite.toJSON)
					{
						args.data.invite = args.data.invite.toJSON();
					}
					
					sendEvent(msg, args);
					break;
				}

				case m.InviteClicked:
				{
					//dbg('Invite clicked', args);
					sendEvent(msg, args);
					break;
				}

				case m.InviteReady:
				{
					if (!args.isLoaded())
					{
						var inviteError = args.getError();
						dbg('Invite error state', inviteError);

						sendEvent(m.InviteError, args);

						return null;
					}

					//dbg('InviteReady: ' + args.getIdInvite() + ' -- isLoaded=' + args.isLoaded());
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
							//sendEvent(m.AdapterInit, { isCard: true });
							updateProgress();
							//cardsController.init(invitesCard);
						}
					}
					else
					{
						// Use the original invite list
						progressTotal += (3 - 1);
						updateProgress();
						cfgViewer.t = args.getIdInvite();	// FIXME: Breaks for multiple initial invites

						loadMap(cfgViewer);
					}

					break;
				}

				case m.CardAdded:
				{
					sendEvent(msg, args);
					//dbg(msg, args);//(msg === m.DataUpdate) ? args : undefined);
					break;
				}

				case m.CardRemoved:
				{
					idCard = args.getId();

					// Remove this card from all tracked ticket invites
					for (var id in mapCardTicketInvites)
					{
						var inv = mapCardTicketInvites[id];
						if (!inv)
						{
							continue;
						}

						idx = inv.indexOf(idCard);
						if (idx >= 0)
						{
							inv.splice(idx, 1);
						}
					}

					sendEvent(msg, args);
					//dbg(msg, args);//(msg === m.DataUpdate) ? args : undefined);
					break;
				}

				case m.DataUpdate:
				case m.InviteAdded:
				case m.InviteRemoved:
				{
					targetCards = mapCardTicketInvites[args.id] || [];

					// send event for each card (same user can share same inviteCode to different cards)
					for (i = targetCards.length - 1; i >= 0; i--)
					{
						sendEvent(msg, $.extend({card: targetCards[i]}, args));
					}
					//dbg(msg, args);//(msg === m.DataUpdate) ? args : undefined);
					break;
				}

				case m.AccountLoginStatus:
				{
					if (args.status)
					{
						// authToken = args.token;
						// cfgAdapter.accountId = cfgViewer.accountId = args.id;
						// cfgAdapter.authToken = cfgViewer.authToken = authToken;
						//dbg('m.AccountInit', args);

						account = coreController.getAccount();
						cfgAdapter.account = account;
						cfgViewer.authToken = account.getToken();

						args.account = account;

						if (glympseLoader)
						{
							glympseLoader.notify(msg, args);
						}

						if (cardsController)
						{
							cardsController.notify(msg, args);
						}

						// do not pass "account" to consumers
						delete args.account;
					}

					sendEvent(msg, args);

					if (!initialized && args.status)
					{
						initialized = true;
						loadInvites();
					}

					break;
				}

				case m.AccountDeleteStatus:
				{
					if (glympseLoader)
					{
						glympseLoader.notify(msg, args);
					}

					if (cardsController)
					{
						cardsController.notify(msg, args);
					}

					sendEvent(msg, args);
					break;
				}

				case m.AccountCreateStatus:
				case m.CreateRequestStatus:
				case m.UserNameUpdateStatus:
				case m.UserAvatarUpdateStatus:
				case m.UserInfoStatus:
				case m.CardsJoinRequestStatus:
				case m.CardsJoinRequestCancelStatus:
				case m.CardActivityStatus:
				case m.CardsActiveJoinRequestsStatus:
				case m.CardRemoveMemberStatus:
				case m.CardsLocationRequestStatus:
				case m.CardsRequestStatus:
				{
					sendEvent(msg, args);
					break;
				}

				case m.GroupLoaded:
				case m.GroupStatus:
				{
					sendEvent(msg, args);
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
		// EVENT HANDLERS
		///////////////////////////////////////////////////////////////////////////////

		function loadInvites()
		{
			sendEvent(m.AdapterReady, { cards: invitesCard, tickets: invitesTicket });

			// Various invite types handled by the map
			var t = cfgAdapter.t;		// Core invite
			var pg = cfgAdapter.pg;		// Core group (public)
			var twt = cfgAdapter.twt;	// Twitter user (@) query
			var g = cfgAdapter.g;		// Twitter topic (#) query

			// Card vs Glympse Invite loading
			if (invitesCard.length > 0 || cardsMode)
			{
				cardsController.init(invitesCard);
				return;
			}

			// During init, look for an object `object`, if it exists, and it has a member of "group",
			// then use this as an initialization for a new Glympse public group to begin loading/parsing, bypassing the normal initial group load
			var obj = cfgAdapter.object || {};
			if (obj.group || pg)
			{
				//dbg('Initial group header received, start processing...', obj);
				coreController.cmd(Defines.CORE.REQUESTS.addGroup, obj.group || pg);
				return;
			}

			// Straight invite types to load
			if (t || g || twt)
			{
				cfgViewer.t = t;
				cfgViewer.twt = twt;
				cfgViewer.g = g;

				loadMap(cfgViewer);
			}
		}

		function loadMap(cfgNew, newMapElement)
		{
			dbg('loadMap!');

			//console.log('cfg.viewer=' + cfgMonitor.viewer);
			$.extend(cfgViewer, cfgNew);

			if (newMapElement)
			{
				cfgMonitor.viewer = newMapElement;
			}

			if (cfgMonitor.viewer)
			{
				//FixMe: viewer can't be initialized w/o invite, so pass incorrect one for now
				cfgViewer.t = cfgViewer.t || 'incorrect';

				viewerMonitor.run();
				$(cfgMonitor.viewer).glympser(cfgViewer);
			}
		}


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
				return targ.cmd(id, data);
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
				{
					curr: Math.min(++progressCurrent, progressTotal)
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
			else if (connectQueueEnabled && (connectQueueMaxSize < 0 || connectQueue.length < connectQueueMaxSize))
			{
				connectQueue.push({id: id, val: val});
			}
		}


		///////////////////////////////////////////////////////////////////////////////
		// HOST REQUEST HANDLERS (APP)
		///////////////////////////////////////////////////////////////////////////////

		function getConfig()
		{
			return publishedConfig;
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
