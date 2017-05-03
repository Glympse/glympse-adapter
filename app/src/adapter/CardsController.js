define(function(require, exports, module)
{
	'use strict';

	// defines
	var lib = require('glympse-adapter/lib/utils');
	var raf = require('glympse-adapter/lib/rafUtils');
	var ajax = require('glympse-adapter/lib/ajax');
	var Defines = require('glympse-adapter/GlympseAdapterDefines');

	var m = Defines.MSG;
	var r = Defines.CARDS.REQUESTS;
	var rl = Defines.CARDS.REQUESTS_LOCAL;
	var REQUEST_TYPES = Defines.CARDS.REQUEST_TYPES;

	// Cards-specific
	var Account = require('glympse-adapter/adapter/models/Account');
	var Card = require('glympse-adapter/adapter/models/Card');

	// Exported class
	function CardsController(controller, cfg)
	{
		// consts
		var dbg = lib.dbg('CardsController', cfg.dbg);
		var svr = cfg.svcGlympse;
		var pollInterval = cfg.pollCards || 60000;
		var pollingInterval;
		var cardsMode = cfg.hasOwnProperty('cardsMode') ? cfg.cardsMode : !!cfg.card;

		// state
		var that = this;
		var cardInvites;
		var cards;
		var cardsIndex;
		var cardsReady = 0;
		var initialized = false;
		var account = cfg.account;
		var cacheCardUpdatedEvts = false;
		var cachedCardUpdatedEvts = [];

		///////////////////////////////////////////////////////////////////////////////
		// PUBLICS
		///////////////////////////////////////////////////////////////////////////////

		this.init = function(cardsInvitesToLoad)
		{
			cards = [];
			cardsIndex = {};
			cardInvites = cardsInvitesToLoad || [];

			cardsReady = (cardInvites) ? cardInvites.length : 0;
			initialized = true;

			controller.notify(m.CardsInitStart, cardInvites);

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

				case m.CardInit:
				{
					controller.notify(msg, args);
					break;
				}

				case m.CardReady:
				{
					controller.notify(msg, args);

					var card = cardsIndex[args];
					if (cards.indexOf(card) === -1)
					{
						cards.push(card);
						controller.notify(m.CardAdded, card);
					}

					if (--cardsReady === 0)
					{
						controller.notify(m.CardsInitEnd, cards);
					}

					break;
				}

				case m.CardUpdated:
				{
                    if (cacheCardUpdatedEvts) {
						cachedCardUpdatedEvts.push(args);
                        return;
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

		this.cmd = function(cmd, args)
		{
			switch (cmd)
			{
				case r.requestCards:
					return requestCards();

				case rl.getCards:
					return getCards();

				case r.request:
					return request(args);

				case r.removeMember:
					return removeMember(args);

				case r.joinRequest:
					return joinRequest(args);

				case r.joinRequestCancel:
					return joinRequestCancel(args);

				case r.getActiveJoinRequests:
					return getActiveJoinRequests();

				case r.activity:
					return getCardActivity(args);

				default:
					dbg('method not found', cmd);
			}
		};


		///////////////////////////////////////////////////////////////////////////////
		// UTILITY
		///////////////////////////////////////////////////////////////////////////////

		function accountInitComplete(args)
		{
			var sig = '[accountInitComplete] - ';

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

			//dbg('Auth token: ' + account.getToken() + ' -- ' + (info && info.token));
			dbg(sig + '[' + ((cfg.isAnon) ? 'ANON' : 'ACCT') + '] Authenticated. Loading ' + cardInvites.length + ' cards...');

			// Now load card(s)
			loadCards(cardInvites);

			if (!cardInvites.length)
			{
				controller.notify(m.CardsInitEnd, []);
			}

			if (cardsMode && cfg.isAnon) {
                getInviteById(cardInvites[0]);
			}
			else
			{
				if (pollingInterval) {
					raf.clearInterval(pollingInterval);
				}
				requestCards();
				pollingInterval = raf.setInterval(requestCards, pollInterval);
			}
		}

		function accountDeleteComplete(){
			account = null;
			if (pollingInterval)
			{
				raf.clearInterval(pollingInterval);
				pollingInterval = null;
			}
		}

		function loadCard(card, fullRequest)
		{
			return {
				card: card,
				request: fullRequest ? getCard(card) : updateCard(card)
			};
		}

		function loadCards(cardInvites)
		{
			if (!cardInvites || !cardInvites.length)
			{
				return;
			}

			var batchRequests = [],
				loadingCards = [],
				loadingCard,
				isNew,
				card,
				cardInvite;

			cardsReady = cardInvites.length;
			for (var i = 0, len = cardInvites.length; i < len; i++)
			{
				cardInvite = cardInvites[i];
				card = cardsIndex[cardInvite];
				isNew = false;
				if (!card)
				{
					card = new Card(that, cardInvite, account, cfg);
					cardsIndex[cardInvite] = card;
					isNew = true;
				}

				loadingCard = loadCard(card, isNew);

				batchRequests.push(loadingCard.request);
				loadingCards.push(loadingCard.card);

				if (card.dirty)
				{
					//need to send additional full request to update card properties
					loadingCard = loadCard(card, true);
					batchRequests.push(loadingCard.request);
					loadingCards.push(loadingCard.card);
				}
			}

			ajax.batch(svr + 'batch', batchRequests, account)
				.then(function(responses)
				{
					var response, i, len, card;
					for (i = 0, len = responses.length; i < len; i++)
					{
						response = responses[i];
						card = loadingCards[i];
						switch (response.name)
						{
							case 'getCard':
								processGetCard(response.result, card);
								break;
							case 'updateCard':
								processUpdateCard(response.result, card);
								break;
						}
					}
				});
		}


		//////////////////////
		// Cards API
		//////////////////////

		/**
		 * Requests cards for the current user.
		 */
        function requestCards()
		{
			ajax.get(svr + 'cards', null, account)
				.then(function(result)
				{
					if (result.status)
					{
						var i, card, len, cardId, allCardIds = [];
						// add new cards
						for (i = 0, len = result.response.length; i < len; i++)
						{
							card = result.response[i];
							allCardIds.push(card.id);
							if (cardInvites.indexOf(card.id) === -1)
							{
								cardInvites.push(card.id);
							}
						}
						// cleanup deleted cards (use while to allow deleting in the loop)
						i = cardInvites.length;
						while (i--)
						{
							cardId = cardInvites[i];
							if (allCardIds.indexOf(cardId) === -1)
							{
								cardInvites.splice(i, 1);
								card = cardsIndex[cardId];
								cards.splice(cards.indexOf(card), 1);
								delete cardsIndex[cardId];
								controller.notify(m.CardRemoved, card);
							}
						}
						// refresh existing cards
						loadCards(cardInvites);
					}

					controller.notify(m.CardsRequestStatus, result);
				});
		}

		function getInviteById(cardId) {
			ajax.get(svr + 'cards/invites/' + cardId, null, account)
				.then(function(result) {
					if (result.status) {
						var card = new Card(that, cardId, account, cfg);
						cardsIndex[cardId] = card;
						processGetCard(result, card);
						result.response = [result.response];
					}
					controller.notify(m.CardsRequestStatus, result);
				});
		}

		/**
		 * Returns currently loaded cards
		 */
		function getCards()
		{
			return cards;
		}

		function getCard(card)
		{
			var idCard = card.getIdCard();

			controller.notify(m.CardInit, idCard);

			var cardUrl = 'cards/' + idCard;

			return {
				name: 'getCard',
				url: cardUrl + '?' +  $.param({members: !card.dirty}),
				method: 'GET'
			};
		}

		function updateCard(card, from, to) {
			var idCard = card.getIdCard();

			var cardUrl = 'cards/' + idCard + '/activity';

			var getParams = { from_ts: card.getLastUpdatingTime() };

			if (from)
			{
				getParams.from_ts = from;
			}

			if (to)
			{
				getParams.to_ts = to;
			}
			return {
				name: 'updateCard',
				url: cardUrl + '?' + $.param(getParams),
				method: 'GET'
			};
		}

		function processGetCard(result, card){
			var idCard = card.getIdCard();

			if (result.status)
			{
				//dbg('Got card data', resp);

				cacheCardUpdatedEvts = true;
				card.setData(result.response);
				if (!card.dirty)
				{
					card.setLastUpdatingTime(result.time);
					that.notify(m.CardReady, idCard);
				}
				else
				{
					card.dirty = false;
				}

				if (cacheCardUpdatedEvts) {
                    flushCardUpdatedEvtCache();
                }
			}
			else if (result.response.error === 'failed_to_decode')
			{
				// Invite is invalid or has been revoked, in
				// either case, we cannot continue loading this
				// card, so bail immediately
				that.notify(m.CardReady, idCard);
			}
		}

		function flushCardUpdatedEvtCache() {
            cacheCardUpdatedEvts = false;
			for (var i = 0, len = cachedCardUpdatedEvts.length; i < len; i++){
				that.notify(m.CardUpdated, cachedCardUpdatedEvts[i]);
			}
		}

		function processUpdateCard(result, card){
			if (result.status)
			{
				//dbg('Got card data', resp);
				if (result.response.length) {
					card.setDataFromStream(result.response, result.time);
				}
				card.setLastUpdatingTime(result.time);
			}
		}


		/**
		 * Request a card member / all card members to share its / their locations
		 *
		 * @param {Object} config Configuration
		 * @param {string} config.inviteCode Invite code generated by the app via adapter.core.createRequest($request_params)
		 * @param {string} config.cardId Card id to remove a member
		 * @param {string} config.memberList List of member ids. If no ids is given, all card members will receive this request.
		 */
		function request(config)
		{
			if (!config || !config.cardId || !config.inviteCode)
			{
				var error = 'cardId & inviteCode config params must be passed';

				dbg(error, config, 3);

				controller.notify(m.CardsLocationRequestStatus, {
					status: false,
					response: { error: error }
				});

				return;
			}

			var url = svr + 'cards/' + config.cardId + '/request';

			var data = {
				invite_code: config.inviteCode,
				invitees: {}
			};

			if (config.memberList && config.memberList.length)
			{
				var members = [];
				for (var i = 0, len = config.memberList.length; i < len; i++)
				{
					members.push({ member_id: config.memberList[i] });
				}
				data.invitees.type = 'list';
				data.invitees.list = members;
			}
			else
			{
				data.invitees.type = 'all';
			}

			ajax.post(url, data, account)
				.then(function(result)
				{
					controller.notify(m.CardsLocationRequestStatus, result);
				});
		}

		/**
		 * Request to join a card
		 *
		 * @param {Object} requestConfig:
		 * {
		 *   type: "${request_type}",
		 *   name: ${requestee_name},
		 *   address: ${requestee_address},
		 *   send: "${send_type}",
		 *   locale: "${locale}",
		 *   region: "${region}"
		 * }
		 */
		function joinRequest(requestConfig)
		{
			var url = svr + 'cards/requests';

			if (!requestConfig.type ||
				(!requestConfig.address && requestConfig.type !== REQUEST_TYPES.CLIPBOARD && requestConfig.type !== REQUEST_TYPES.LINK))
			{
				var error = 'Need to provide type (Defines.CARDS.REQUEST_TYPES: LINK, CLIPBOARD, SMS, EMAIL, ACCOUNT) ' +
					'and address (except LINK and CLIPBOARD types) to join a card';

				dbg(error, requestConfig, 3);

				controller.notify(m.CardsJoinRequestStatus, {
					status: false,
					response: { error: error }
				});

				return;
			}
			requestConfig.send = requestConfig.send || 'server';

			ajax.post(url, requestConfig, account)
				.then(function(result)
				{
					controller.notify(m.CardsJoinRequestStatus, result);
				});
		}

		function joinRequestCancel(requestId)
		{
			var url = svr + 'cards/requests/' + requestId;

			ajax.delete(url, account)
				.then(function(result)
				{
					if (result.status)
					{
						result.response.id = requestId;
					}
					controller.notify(m.CardsJoinRequestCancelStatus, result);
				});
		}

		function getActiveJoinRequests()
		{
			var url = svr + 'cards/requests';

			ajax.get(url, null, account)
				.then(function(result)
				{
					controller.notify(m.CardsActiveJoinRequestsStatus, result);
				});
		}

		/**
		 * Removes a member from a given card
		 *
		 * @param {Object} config Configuration
		 * @param {string} config.cardId Card id to remove a member
		 * @param {string} config.memberId Member id of the member to remove. If no memberId is given, the current user is removed.
		 */
		function removeMember(config)
		{
			if (!config || !config.cardId)
			{
				dbg('CardId param is mandatory!', config, 3);
				return;
			}

			var memberId = config.memberId;
			var card;
			if (!memberId)
			{
				card = cardsIndex[config.cardId];
				if (!card)
				{
					dbg('card not found for CardId=', config.cardId, 3);
					return;
				}
				var members = card.getMembers();
				for (var i = 0, len = members.length, member; i < len; i++)
				{
					member = members[i];
					if (member.getUserId() === account.getId())
					{
						memberId = member.getId();
						break;
					}
				}
				if (!memberId)
				{
					dbg('current member not found for card=', card.toJSON(), 3);
					return;
				}
			}

			ajax.delete((svr + 'cards/' + config.cardId + '/members/' + memberId), account)
				.then(function(result)
				{
					if (result.status)
					{
						result.response.cardId = config.cardId;
						result.response.memberId = memberId;

						requestCards();
					}

					controller.notify(m.CardRemoveMemberStatus, result);
				});
		}

		function getCardActivity(config)
		{
			if (!config || !config.cardId)
			{
				dbg('CardId param is mandatory!', config, 3);
				return;
			}

			var cardId = config.cardId,
				card = cardsIndex[cardId];

			if (!card)
			{
				dbg('Card with id=' + cardId + ' not found!', config, 3);
				return;
			}

			var requestConfig = updateCard(card, config.fromTS, config.toTS);

			ajax.makeRequest(
				{
					url: (svr + requestConfig.url),
					type: requestConfig.method
				},
				account
			)
				.then(function(result)
				{
					if (result.status)
					{
						result.cardId = cardId;
					}

					controller.notify(m.CardActivityStatus, result);
				});
		}
	}


	module.exports = CardsController;
});
