///////////////////////////////////////////////////////////////////////////////
// AJAX requests utilities
///////////////////////////////////////////////////////////////////////////////

define(function(require, exports, module)
{
	'use strict';

	var lib = require('glympse-adapter/lib/utils');

	var MAX_ATTEMPTS = 3;
	var DEFAULT_OPTIONS = {
		ALL: { dataType: 'json' },
		POST: { contentType: 'application/json' }
	};

	function parseResponse(data)
	{
		var result = null;

		if (data && data.response)
		{
			result = { status: false, response: {} };

			if (data.result === 'ok')
			{
				result.status = true;
				result.response = data.response;
				result.time = data.meta && data.meta.time;
			}

			if (data.result === 'failure')
			{
				var meta = data.meta || {};

				result.response = meta;
				// check if we need them, left for now for backward compatibility
				result.error = meta.error;
				result.errorDetail = meta.error_detail;
			}
		}

		return result;
	}

	function processResponse(account)
	{
		var that = this;

		return function(data)
		{
			// arguments
			// data|jqXHR, textStatus, jqXHR|errorThrown

			that.attempts--;

			var result = parseResponse(data);

			if (result)
			{
				// in case of token error try to get new token & re-run action
				if (result.error === 'oauth_token' || result.error === 'token_expired' || result.error === 'access_denied')
				{
					if (account)
					{
						console.warn('[ajax] token error for authorized API request');
						account.generateToken(function(authResult)
						{
							if (authResult.status)
							{
								if (that.retry)
								{
									that.retry();
								}
							}
							else
							{
								result.authResult = authResult;
								that.request.resolve(result);
							}
						});

						return;
					}
					else
					{
						console.warn('[ajax] token error for public API request');
						result.invalidToken = true;
					}
				}

				that.request.resolve(result);

				return;
			}

			result = { status: false };

			if (that.retry && that.attempts > 0)
			{
				var attempt = (MAX_ATTEMPTS - that.attempts);
				setTimeout(
					function()
					{
						that.retry();
					},
					// Incremental + random offset delay between retry in case of short availability outage
					(attempt * (500 + Math.round(1000 * Math.random())))
				);

				result.info = { attempt: attempt, result: data };

				that.request.notify(result);

				return;
			}

			result.info = { status: 'max_attempts', lastResult: data };

			that.request.resolve(result);
		};
	}

	var api = {
		requestHeaders: {},

		/**
		 * @function ajax.makeRequest
		 *
		 * @param {object} jqOptions - options for jQuery ajax method
		 * @param {object} [auth|account] - authorization data (required for auth requests):
		 * 									can be either auth object (documented below) or account instance
		 *
		 * @param {object} [auth.account] - account instance
		 * @param {boolean} [auth.useBearer] - if should use bearer auth header instead of url param (default: true)
		 * @param {boolean} [retryOnError] - if should re-try on temporary server errors (default: true)
		 *
		 * @returns {$.Deferred}
		 */
		makeRequest: function makeRequest(jqOptions, auth, retryOnError)
		{
			var account;
			var options = $.extend({}, DEFAULT_OPTIONS.ALL, jqOptions);

			if (auth)
			{
				var useBearer = true;
				if (auth.account)
				{
					account = auth.account;
					useBearer = (auth.useBearer !== false);
				}
				else
				{
					account = auth;
				}

				if (useBearer)
				{
					options.beforeSend = function(request)
					{
						request.setRequestHeader('Authorization', 'Bearer ' + account.getToken());
					};
				}
				else
				{
					options.url += ((options.url.indexOf('?') < 0) ? '?' : '&') + 'oauth_token=' + account.getToken();
				}
			}

			options.headers = $.extend({}, options.headers, this.requestHeaders);

			var context = {
				request: $.Deferred(),
				attempts: ((retryOnError === false) ? 1 : MAX_ATTEMPTS),
				retry: function()
				{
					// console.debug('[ajax] retry', options);
					$.ajax(options).always(processResponse.call(context, account));
				}
			};

			$.ajax(options).always(processResponse.call(context, account));

			return context.request;
		},

		/**
		 * @function ajax.get
		 */
		get: function reqGet(url, data, auth, jqOptions, retryOnError)
		{
			return api.makeRequest($.extend({ url: url, type: 'GET', data: data }, jqOptions), auth, retryOnError);
		},

		/**
		 * @function ajax.post
		 */
		post: function reqPost(url, data, auth, jqOptions, retryOnError)
		{
			var options = $.extend({ url: url, type: 'POST' }, DEFAULT_OPTIONS.POST, jqOptions);

			if (data)
			{
				if (options.contentType === 'application/json')
				{
					data = JSON.stringify(data);
				}

				options.data = data;
			}

			return api.makeRequest(options, auth, retryOnError);
		},

		/**
		 * @function ajax.delete
		 */
		delete: function reqDelete(url, auth, jqOptions, retryOnError)
		{
			return api.makeRequest($.extend({ url: url, type: 'DELETE'}, DEFAULT_OPTIONS.POST, jqOptions), auth, retryOnError);
		},

		/**
		 * @function ajax.batch
		 */
		batch: function reqBatch(batchEndpoint, batchRequests, auth, jqOptions, retryOnError)
		{
			return api.post(batchEndpoint, batchRequests, auth, jqOptions, retryOnError)
				.then(function(batchResponse)
				{
					var i, len, response;
					var responses = [];

					if (batchResponse.status)
					{
						var results = batchResponse.response.items || [];
						for (i = 0, len = results.length; i < len; i++)
						{
							response = parseResponse(results[i].body);
							response.time = batchResponse.time;

							responses.push({
								name: results[i].name,
								result: response
							});
						}
					}
					else
					{
						for (i = 0, len = batchRequests.length; i < len; i++)
						{
							var req = batchRequests[i];
							responses.push({
								name: req.name,
								result: batchResponse
							});
						}
					}

					return responses;
				});
		}

	};

	module.exports = api;
});
