define(function(require, exports, module)
{
    'use strict';

	var lib = require('glympse-adapter/lib/utils');
	var Member = require('glympse-adapter/adapter/models/Member');
	var Defines = require('glympse-adapter/GlympseAdapterDefines');
	var m = Defines.MSG;


	// Exported class
	function Card(controller, idCard, token, cfg)
	{
		// state
		var attempts = 0;
		var data;
		var loaded = false;
		var members;
		var that = this;

		// consts
		var dbg = lib.dbg('Card', cfg.dbg);
		var svr = (cfg.svcCards || '//api.cards.sandbox.glympse.com/api/v1/');
		var cardUrl = (svr + 'cards/invites/' + idCard);
		var cardParams = { members: true };
		var cMaxAttempts = 3;

		// TODO: Just map data props directly??
		//	---> Only want immediate non-Objects/Arrays
		var props = [ 'name'
					, 'type_id'
					, 'last_modified'
					, 'created_time'
					, 'id'
					, 'metadata_etag'
					];


		///////////////////////////////////////////////////////////////////////////////
		// PROPERTIES
		///////////////////////////////////////////////////////////////////////////////

		// NOTE: some properties created via lib.mapProps

		this.getMembers = function()
		{
			return members;
		};

		this.getMetaData = function()
		{
			return data.metadata;
		};

		this.isLoaded = function()
		{
			return loaded;
		};

		this.getIdCard = function()
		{
			return idCard;
		};

		this.getData = function()
		{
			return data;
		};

		this.setData = function(val)
		{
			data = val;
			lib.mapProps(this, props, data);

			var mems = data.members;
			members = [];
			for (var i = 0, len = ((mems && mems.length) || 0); i < len; i++)
			{
				members.push(new Member(mems[i], cfg));
			}

			dbg('Card "' + this.getName() + '" ready with ' + members.length + ' members');
		};


		///////////////////////////////////////////////////////////////////////////////
		// PUBLICS
		///////////////////////////////////////////////////////////////////////////////

		this.init = function()
		{
			if (!idCard || !token)
			{
				return false;
			}

			// Kick off card load
			attempts = 0;
			loadCard();

			return true;
		};

		this.toJSON = function()
		{
			return data;
		};


		///////////////////////////////////////////////////////////////////////////////
		// UTILITY
		///////////////////////////////////////////////////////////////////////////////

		function loadCard()
		{
			controller.notify(m.CardInit, idCard);

			$.ajax(
			{
				type: 'GET',
				dataType: 'JSON',
				beforeSend: function(request)
				{
					request.setRequestHeader('Authorization', 'Bearer ' + token);
				},
				url: cardUrl,
				data: cardParams,
				processData: true
			})
			//$.getJSON(cardUrl, cardParams)
			.done(function(data)
			{
				processCardData(data);
			})
			.fail(function(xOptions, status)
			{
				processCardData(null);
			});
		}

		function processCardData(resp)
		{
			attempts++;

			try
			{
				if (resp)
				{
					if (resp.response && resp.result === 'ok')
					{
						//dbg('Got card data', resp);
						loaded = true;
						that.setData(resp.response);
						controller.notify(m.CardReady, idCard);
						return;
					}
					else if (resp.meta && resp.meta.error)
					{
						// Invite is invalid or has been revoked, in
						// either case, we cannot continue loading this
						// card, so bail immediately
						if (resp.meta.error === 'failed_to_decode')
						{
							loaded = false;
							controller.notify(m.CardReady, idCard);
							return;
						}
					}
				}
			}
			catch (e)
			{
				dbg('Error parsing card', e);
			}

			//dbg('attempt: ' + attempts + ', last data', data);

			if (attempts < cMaxAttempts)
			{
				setTimeout(function()
				{
					loadCard();
				}, attempts * (500 + Math.round(1000 * Math.random()))	// Incremental + random offset delay between retry in case of short availability outage
				);

				return;
			}

			dbg('Max attempts: (' + attempts + ') -- ' + ((data && data.result) || 'data=null'));
			controller.notify(m.CardReady, idCard);
		}


		///////////////////////////////////////////////////////////////////////////////
		// CTOR
		///////////////////////////////////////////////////////////////////////////////
	}

	// Card defines


	module.exports = Card;
});
