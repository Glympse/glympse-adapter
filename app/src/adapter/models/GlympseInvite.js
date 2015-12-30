define(function(require, exports, module)
{
    'use strict';

	var lib = require('glympse-adapter/lib/utils');
	var Defines = require('glympse-adapter/GlympseAdapterDefines');
	var m = Defines.MSG;
	var cOauthToken = 'oauth_token';
	var cModuleId = 'GlympseInvite';


	// Exported class
	function GlympseInvite(controller, idInvite, account, cfg)
	{
		// consts
		var dbg = lib.dbg(cModuleId, cfg.dbg);
		var svr = (cfg.svcGlympse || '//api.glympse.com/v2/');
		var inviteUrl = (svr + 'invites/' + idInvite);
		var cMaxAttempts = 3;

		// state
		var attempts = 0;
		var next = 0;
		var data;
		var error;
		var loaded = false;
		var that = this;
		var inviteParams = { 'no_count': true, 'next': next };

		// TODO: Just map data props directly??
		//	---> Only want immediate non-Objects/Arrays
		var props = [ 'first'
					, 'last'
					, 'next'
					, 'properties'
					, 'type'
					];


		///////////////////////////////////////////////////////////////////////////////
		// PROPERTIES
		///////////////////////////////////////////////////////////////////////////////

		// NOTE: some properties created via lib.mapProps

		this.isLoaded = function()
		{
			return loaded;
		};

		this.getIdInvite = function()
		{
			return idInvite;
		};

		this.getError = function()
		{
			return error;
		};

		this.getData = function()
		{
			return data;
		};

		// NOTE: make available in case of invalid invite
		this.getReference = function()
		{
			return data && data.reference;
		};

		this.setData = function(val)
		{
			data = val;
			data.location = null;	// Don't cache location!
			lib.mapProps(this, props, data);

			//dbg('Invite "' + this.getIdInvite() + '" loaded (reference: "' + this.getReference() + '")');
		};


		///////////////////////////////////////////////////////////////////////////////
		// PUBLICS
		///////////////////////////////////////////////////////////////////////////////

		this.load = function()
		{
			var token = account.getToken();

			if (!idInvite || !token)
			{
				return false;
			}

			// Kick off invite load
			error = null;
			attempts = 0;
			inviteParams[cOauthToken] = token;

			loadInvite();

			return true;
		};

		this.toString = function()
		{
			return '[' + cModuleId + ']: ' + JSON.stringify(data);
		};

		this.toJSON = function()
		{
			return data || error;
		};


		///////////////////////////////////////////////////////////////////////////////
		// UTILITY
		///////////////////////////////////////////////////////////////////////////////

		function loadInvite()
		{
			controller.notify(m.InviteInit, idInvite);

			$.ajax(
			{
				type: 'GET',
				dataType: 'JSON',
				url: inviteUrl,
				data: inviteParams,
				processData: true
			})
			.done(function(data)
			{
				processInviteData(data);
			})
			.fail(function(xOptions, status)
			{
				processInviteData(null);
			});
		}

		function processInviteData(data)
		{
			attempts++;

			//dbg('invite data: ', data);
			try
			{
				if (data)
				{
					var result = data.result;
					if (result === 'ok')
					{
						loaded = true;
						that.setData(data.response);
					}
					else
					{
						error = data.meta || {};
						error.id = lib.normalizeInvite(idInvite);
					}

					controller.notify(m.InviteReady, that);
					return;
				}
			}
			catch (e)
			{
				dbg('Error parsing invite', e);
			}

			if (attempts < cMaxAttempts)
			{
				setTimeout(function()
				{
					loadInvite();
				}, attempts * (500 + Math.round(1000 * Math.random()))	// Incremental + random offset delay between retry in case of short availability outage
				);

				return;
			}

			error = { 'error': 'load_failure'
					, 'error_detail': 'Failed ' + cMaxAttempts + ' attempts'
					};

			controller.notify(m.InviteReady, that);
		}


		///////////////////////////////////////////////////////////////////////////////
		// CTOR
		///////////////////////////////////////////////////////////////////////////////
	}

	// GlympseInvite defines


	module.exports = GlympseInvite;
});
