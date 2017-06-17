define(function(require, exports, module)
{
    'use strict';

	var lib = require('glympse-adapter/lib/utils');
	var ajax = require('glympse-adapter/lib/ajax');
	var Defines = require('glympse-adapter/GlympseAdapterDefines');
	var imageProcessing = require('glympse-adapter/lib/image');
	var md5 = require('glympse-adapter/lib/md5');

	var m = Defines.MSG;
	var REQUEST_TYPES = Defines.CARDS.REQUEST_TYPES;

	var cAcctTokenName = 't0';
	var cAccountInfo = 'accountInfo';
	var cApiKey = 'api_key';
	var cPassword = 'p0';
	var cUserName = 'n0';
	var cSvcPassword = 'password';
	var cSvcUserName = 'username';
	var cEnvProduction = 'EnvProd';
	var cEnvSandbox = 'EnvSandbox';

	var anonymousUserName = 'viewer';
	var anonymousPassword = 'password';

	// Exported class
	function Account(controller, cfg)
	{
		// consts
		var dbg = lib.dbg('Account', cfg.dbg);

		var svr = cfg.svcGlympse;
		var sandbox = cfg.sandbox;
		var idEnvironment = (sandbox) ? Account[cEnvSandbox] : Account[cEnvProduction];

		var account = {};

		var apiKey = cfg.apiKey;
		var hashApiKey = md5(apiKey);

		var urlCreate = (svr + 'account/create');
		var urlLogin = (svr + 'account/login');

		// state
		var isAnon = cfg.isAnon;
		var token;

		var settings;
		var currentEnvKeys;
		var currentKeySettings;

		var that = this;

		var gettingTokenProcess = null;

		account[cApiKey] = apiKey;

		///////////////////////////////////////////////////////////////////////////////
		// PROPERTIES
		///////////////////////////////////////////////////////////////////////////////

		this.getToken = function()
		{
			return token;
		};

		this.getId = function()
		{
			return account[cSvcUserName];
		};


		///////////////////////////////////////////////////////////////////////////////
		// PUBLICS
		///////////////////////////////////////////////////////////////////////////////

		this.init = function()
		{
			getSettings();

			// If not anonymous, add saved username/password to token request
			if (!isAnon)
			{
				var u = currentKeySettings[cUserName];
				var p = currentKeySettings[cPassword];

				if (!u || !p)
				{
					controller.notify(m.AccountLoginStatus, {
						status: false,
						error: 'no_account',
						errorDetail: 'No account exists for the current apiKey.'
					});
					return false;
				}

				account[cSvcUserName] = u;
				account[cSvcPassword] = p;
			}
			else
			{
				account[cSvcUserName] = anonymousUserName;
				account[cSvcPassword] = anonymousPassword;
			}

			// check for token after checking for user/password as they are required for getting new token (after expiration or smth)
			token = currentKeySettings[cAcctTokenName];
			if (token)
			{
				// validate token before sending init event
				if (!isAnon)
				{
					getUserInfo(null, true);
				}
				else {
					controller.notify(m.AccountLoginStatus, {
						status: true,
						token: token,
						anonymous: true
					});
				}
				return true;
			}

			getNewToken();

			return false;
		};

		this.generateToken = function(callback)
		{
			token = null;
			getNewToken(callback);
		};

		this.create = function()
		{
			if (!isAnon)
			{
				createAccount();
			}
			else
			{
				dbg('Creating account failed, no API key available');
			}
		};

		this.setName = function(newName)
		{
			var apiUrl = (svr + 'users/self/update');

			ajax.get(apiUrl, { name: newName }, that)
				.then(function(result)
				{
					controller.notify(m.UserNameUpdateStatus, result);
				});
		};

		this.setAvatar = function(urlOrAvatarDataArray)
		{
			var that = this;
			var avatarCfg = cfg.avatar || {};

			if (typeof urlOrAvatarDataArray === 'string')
			{
				imageProcessing.loadDataArrayByUrl(urlOrAvatarDataArray, loadImageCallback);
				return false;
			}

			var imageScaleConfig = {
				minSize: [
					avatarCfg.minSize || 120,
					avatarCfg.minSize || 120
				],
				maxSize: [
					avatarCfg.maxSize || 512,
					avatarCfg.maxSize || 512
				],
				maintainAspectRatio: true,
				sidebandFill: '#fff',
				convertAlpha: '#fff'
			};

			imageProcessing.imageScale(urlOrAvatarDataArray, imageScaleConfig, imageScaleCallback);

			function loadImageCallback(dataArray, error)
			{
				if (dataArray)
				{
					that.setAvatar(dataArray);
				}
				else
				{
					controller.notify(m.UserAvatarUpdateStatus, error);
				}
			}

			function imageScaleCallback(dataArray)
			{
				var apiUrl = (svr + 'users/self/upload_avatar');

				ajax.post(apiUrl, new Uint8Array(dataArray), that, {
					contentType: 'image/jpeg',
					processData: false
				})
					.then(function(result)
					{
						controller.notify(m.UserAvatarUpdateStatus, result);
					});
			}
		};

		this.getUserInfo = getUserInfo;

		this.hasAccount = function()
		{
			getSettings();

			return !!(!isAnon && currentKeySettings[cUserName] && currentKeySettings[cPassword]);
		};

		/**
		 * Allow logged in user to generate a sharing request.
		 * @param {Object} config endpoint options
		 * request_params format:
		 * {
         *  type: string,     // Type of request -- email|sms|link|account|app ---> only accepts/uses "link" for now
         *  subtype: string,  // [OPTIONAL] Subtype of "app" types (50 char max) --> unused for now
         *  address: string,  // [OPTIONAL] Address of recipient for some types of requests (256 char max) --> unused for now
         *  name: string,     // [OPTIONAL] A friendly display name to be associated with the requestee. (150 char max)
         *  text: string,     // [OPTIONAL] Message to send --> unused for now
         *  send: string,     // [OPTIONAL] Values server|client --> unused for now
         *  locale: string,   // [OPTIONAL] Locale for localized resources --> unused for now
         *  brand: string,    // [OPTIONAL] Defines any sub-brand customization for the invite --> unused for now
         * }
		 */
		this.createRequest = function(config)
		{
			if (!config || !config.type || config.type !== REQUEST_TYPES.LINK)
			{
				var error = '"type" must be provided (NOTE: only Defines.CARDS.REQUEST_TYPES.LINK type is supported for now)';

				dbg(error, config, 3);

				controller.notify(m.CreateRequestStatus, {
					status: false,
					response: { error: error }
				});

				return;
			}

			var url = svr + 'users/self/create_request?' + $.param(config);

			ajax.post(url, null, that)
				.then(function(result)
				{
					controller.notify(m.CreateRequestStatus, result);
				});
		};

		this.delete = function()
		{
			//delete all storages for this account
			deleteSettings();

			controller.notify(m.AccountDeleteStatus, { status: true });
		};

		///////////////////////////////////////////////////////////////////////////////
		// UTILITY
		///////////////////////////////////////////////////////////////////////////////

		function saveSettings()
		{
			currentEnvKeys[hashApiKey] = currentKeySettings;
			settings[idEnvironment] = currentEnvKeys;
			lib.setCfgVal(cAccountInfo, settings);
		}

		function getSettings()
		{
			settings = lib.getCfgVal(cAccountInfo) || {};
			currentEnvKeys = settings[idEnvironment] || {};

			// check for settings under apiKey first to not break old accounts
			currentKeySettings = currentEnvKeys[apiKey];

			if (currentKeySettings)
			{
				dbg('.. migrating old settings ..');

				// save in new format
				delete currentEnvKeys[apiKey];
				saveSettings();
			}
			else
			{
				currentKeySettings = currentEnvKeys[hashApiKey] || {};
			}
		}

		function deleteSettings()
		{
			getSettings();
			currentKeySettings = {};
			saveSettings();
		}

		function getNewToken(callback)
		{
			// do not allow multiple log-ins at the same time
			if (!gettingTokenProcess)
			{
				gettingTokenProcess = ajax.get(urlLogin, account)
					.then(function(result)
					{
						if (result.status)
						{
							token = result.response.access_token;
							currentKeySettings[cAcctTokenName] = token;
							saveSettings();

							//dbg('>> new token: ' + token);

							result.id = account[cSvcUserName];
							result.token = token;
						}

						controller.notify(m.AccountLoginStatus, result);

						gettingTokenProcess = null;

						return result;
					});
			}

			if (callback)
			{
				gettingTokenProcess.then(function(result)
				{
					callback(result);
				});
			}
		}

		function getUserInfo(userId, checkToken)
		{
			var apiUrl = svr + 'users/' + (userId || 'self');

			ajax.get(apiUrl, null, that)
				.then(function(result)
				{
					if (result.status)
					{
						// can be useful for properly filtering events on consumer side
						result.response.userId = userId;
					}

					if (checkToken)
					{
						controller.notify(m.AccountLoginStatus, {
							status: true,
							token: token,
							id: currentKeySettings[cUserName]
						});
					}
					else
					{
						controller.notify(m.UserInfoStatus, result);
					}
				});
		}

		function createAccount()
		{
			var opts = {};

			opts[cApiKey] = account[cApiKey];

			ajax.get(urlCreate, opts)
				.then(function(result)
				{
					if (result.status)
					{
						var resp = result.response;

						var id = resp.id;
						var pw = resp.password;

						account[cSvcUserName] = id;
						account[cSvcPassword] = pw;

						currentKeySettings[cUserName] = id;
						currentKeySettings[cPassword] = pw;

						saveSettings();
					}

					controller.notify(m.AccountCreateStatus, result);
				});
		}
	}

	// Account defines

	// Environment
	Account[cEnvProduction] = 'prod';
	Account[cEnvSandbox] = 'sbox';


	module.exports = Account;
});
