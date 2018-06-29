// App entry point
define(function(require, exports, module)
{
    'use strict';

	var Defines =
	{
		  PORT: 'glympse'

		, MAP: {

			/////////////////////////////////////////
			// API Endpoints - host and client
			/////////////////////////////////////////

			REQUESTS: {
				  addInvites: 'addInvites'
				, addGroups: 'addGroups'
				, addMarkers: 'addMarkers'
				, addTwitterTopics: 'addTwitterTopics'
				, addTwitterUsers: 'addTwitterUsers'
				, refreshView: 'refreshView'
				, removeInvites: 'removeInvites'
				, setApiServices: 'setApiServices'
				, setPadding: 'setPadding'
				, setUserInfo: 'setUserInfo'	// Send-only... break it out?
				, updateSetting: 'updateSetting'
			}


			/////////////////////////////////////////
			// API Endpoints: client-only
			/////////////////////////////////////////

			, REQUESTS_LOCAL: {
				  getInvites: 'getInvites'
				, getMap: 'getMap'
				, getMapContainer: 'getMapContainer'
				, generateRoute: 'generateRoute'
				, ignoreDestinations: 'ignoreDestinations'
			}
		}

		, CARDS: {

			/////////////////////////////////////////
			// API Endpoints - host and client
			/////////////////////////////////////////

			REQUESTS: {
				requestCards: 'requestCards'
				, request: 'request'
				, joinRequest: 'joinRequest'
				, joinRequestCancel: 'joinRequestCancel'
				, getActiveJoinRequests: 'getActiveJoinRequests'
				, removeMember: 'removeMember'
				, activity: 'activity'
				//  addInvites: 'addInvites'
				//, getInvites: 'getInvites'
				//, removeInvites: 'removeInvites'
				//, setServices: 'setServices'
				//, updateSetting: 'updateSetting'
			}


			/////////////////////////////////////////
			// API Endpoints: client-only
			/////////////////////////////////////////

			, REQUESTS_LOCAL: {
				getCards: 'getCards'
			}

			/////////////////////////////////////////
			// API Endpoints: client-only
			/////////////////////////////////////////

			, REQUEST_TYPES: {
				LINK: 'link'
				, CLIPBOARD: 'clipboard'
				, SMS: 'sms'
				, EMAIL: 'email'
				, ACCOUNT: 'account'
			}
		}

		, CORE: {

			/////////////////////////////////////////
			// API Endpoints - host and client
			/////////////////////////////////////////

			REQUESTS: {
				addGroup: 'addGroup'
				, getGroups: 'getGroups'
				, removeGroup: 'removeGroup'
				, getOrgObjects: 'getOrgObjects'
				, getEtaInfo: 'getEtaInfo'
				, getInviteEta: 'getInviteEta'
			}


			/////////////////////////////////////////
			// API Endpoints: client-only
			/////////////////////////////////////////

			, REQUESTS_LOCAL: {
				accountCreate: 'accountCreate'
				, accountDelete: 'accountDelete'
				, generateAuthToken: 'generateAuthToken'
				, getUserInfo: 'getUserInfo'
				, setUserName: 'setUserName'
				, setUserAvatar: 'setUserAvatar'
				, hasAccount: 'hasAccount'
				, createRequest: 'createRequest'
			}
		}


		/////////////////////////////////////////
		// Notification messages
		/////////////////////////////////////////

		, MSG: {
			//Account Events
			  AccountCreateStatus: 'AccountCreateStatus'
			, AccountDeleteStatus: 'AccountDeleteStatus'
		    , AccountLoginStatus: 'AccountLoginStatus'
			, UserNameUpdateStatus: 'UserNameUpdateStatus'
			, UserAvatarUpdateStatus: 'UserAvatarUpdateStatus'
			, UserInfoStatus: 'UserInfoStatus'
			, CreateRequestStatus: 'CreateRequestStatus'

		    , AdapterInit: 'AdapterInit'
			, AdapterReady: 'AdapterReady'

			//Card events
			, CardInit: 'CardInit'
			, CardReady: 'CardReady'
			, CardsInitEnd: 'CardsInitEnd'
			, CardsInitStart: 'CardsInitStart'
			, CardUpdated: 'CardUpdated'
			, CardAdded: 'CardAdded'
			, CardRemoved: 'CardRemoved'
			, CardsRequestStatus: 'CardsRequestStatus'
			, CardsJoinRequestStatus: 'CardsJoinRequestStatus'
			, CardsJoinRequestCancelStatus: 'CardsJoinRequestCancelStatus'
			, CardActivityStatus: 'CardActivityStatus'
			, CardsActiveJoinRequestsStatus: 'CardsActiveJoinRequestsStatus'
			, CardRemoveMemberStatus: 'CardRemoveMemberStatus'
			, CardsLocationRequestStatus: 'CardsLocationRequestStatus'

			// Public group events
			, GroupLoaded: 'GroupLoaded'
			, GroupStatus: 'GroupStatus'
			, OrgObjects: 'OrgObjects'

			, EtaInfo: 'EtaInfo'
			, InviteEta: 'InviteEta'

			, DataUpdate: 'DataUpdate'
			, InviteAdded: 'InviteAdded'
			, InviteClicked: 'InviteClicked'
			, InviteError: 'InviteError'
			, InviteInit: 'InviteInit'
			, InviteReady: 'InviteReady'
			, InviteRemoved: 'InviteRemoved'
			, OauthError: 'OauthError'
			, Progress: 'Progress'
			, StateUpdate: 'StateUpdate'
			, ViewerInit: 'ViewerInit'
			, ViewerReady: 'ViewerReady'
			, ViewerZoomChanged: 'ViewerZoomChanged'
		}


		///////////////////////////////////////////////////
		// State updates -- probably will move/remove
		///////////////////////////////////////////////////

		, STATE: {
			// Known data stream properties
			  Avatar: 'avatar'
			, Destination: 'destination'
			, Eta: 'eta'
			, InviteEnd: 'end_time'
			, InviteCompleted: 'completed'
			, InviteStart: 'start_time'
			, Message: 'message'
			, Name: 'name'
			, Owner: 'owner'
			, Phase: 'phase'

			// Additional meta-data state
			, Arrived: 'Arrived'	// needed?
			, Expired: 'Expired'
			, NoInvites: 'NoInvites'
			, App: 'app'
		}
	};


	// Global namespace registration
	(function(w) {
		var g = w.glympse || {};
		/* eslint-disable no-unused-expressions */
		g.broadcastTypes || (g.broadcastTypes = {
								DATA: 'DATA',
								ETA: 'ETA',
								INVITE_STATUS: 'INVITE_STATUS',
								ZOOM: 'ZOOM'
							});
		g.GlympseAdapterDefines || (g.GlympseAdapterDefines = Defines);
		/* eslint-enable no-unused-expressions */

		w.glympse = g;
	})(window);


	module.exports = Defines;
});
