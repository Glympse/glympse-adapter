define(function(require, exports, module)
{
    'use strict';

	// defines
	var Defines = require('glympse-adapter/GlympseAdapterDefines');
	var lib = require('glympse-adapter/lib/utils');
	var m = Defines.MSG;
	var s = Defines.STATE;
	var r = Defines.MAP.REQUESTS;

	var cEtaVal = 'eta';
	var cEtaTime = 'eta_ts';

	// Exported class
	function MapController(controller, cfg)
	{
		// consts
		var glyEvents = window.glympse.events;
		var propMap = [ s.Avatar
					  , s.Destination
					  , s.InviteStart
					  , s.InviteEnd
					  , s.Eta
					  , s.Message
					  , s.Name
					  , s.Phase
					  , s.Expired
					  , s.App
					  ];	// Known/tracked properties

		// state
		var timerEnd;
		var viewerApp;
		var viewerElement;

		var that = this;
		var cmdQueue = [];
		var props = { };

		var dbg = lib.dbg('MapController', cfg.dbg);


		///////////////////////////////////////////////////////////////////////////////
		// PROPERTIES
		///////////////////////////////////////////////////////////////////////////////

		//this.getViewer = function()
		//{
		//	return viewerApp;
		//};


		///////////////////////////////////////////////////////////////////////////////
		// PUBLICS
		///////////////////////////////////////////////////////////////////////////////

		this.run = function()
		{
			if (!cfg.viewer)
			{
				dbg('No viewer set. Aborting...');
				return;
			}

			// Set up handlers
			viewerElement = cfg.viewer;
			viewerElement.addEventListener(glyEvents.INIT, viewerInit, false);
			viewerElement.addEventListener(glyEvents.READY, viewerReady, false);
			viewerElement.addEventListener(glyEvents.DATA, viewerData, false);
			viewerElement.addEventListener(glyEvents.PROPERTIES, viewerData, false);
			viewerElement.addEventListener(glyEvents.ETA, viewerEta, false);
			viewerElement.addEventListener(glyEvents.INVITE_ADDED, viewerInviteAdded, false);
			viewerElement.addEventListener(glyEvents.INVITE_REMOVED, viewerInviteRemoved, false);
			viewerElement.addEventListener(glyEvents.INVITE_CLICKED, viewerInviteClicked, false);
			viewerElement.addEventListener(glyEvents.INVITE_ERROR, viewerInviteError, false);
			viewerElement.addEventListener(glyEvents.OAUTH_TOKEN_ERROR, viewerOauthTokenError, false);
		};

		this.shutdown = function()
		{
			viewerElement.removeEventListener(glyEvents.DATA, viewerData, false);
			viewerElement.removeEventListener(glyEvents.PROPERTIES, viewerData, false);
			viewerElement.removeEventListener(glyEvents.ETA, viewerEta, false);
		};

		this.getCurrentProperties = function(idInvite)
		{
			idInvite = (idInvite && lib.simplifyInvite(idInvite));

			// Allow for simpler property-bag retrieval if only
			// tracking one invite
			if (!idInvite)
			{
				for (idInvite in props)
				{
					if (idInvite)
					{
						break;
					}
				}
			}

			if (props.hasOwnProperty(idInvite))
			{
				return props[idInvite];
			}

			return 'Unknown invite "' + idInvite + '"';
		};

		this.getCurrentValue = function(idProperty, idInvite)
		{
			var prop = this.getCurrentProperties(idInvite);

			if (typeof prop === 'string')
			{
				return prop;
			}

			if (idProperty && prop.hasOwnProperty(idProperty))
			{
				return prop[idProperty];
			}

			return 'Unknown property id "' + idProperty + '" for invite "' + idInvite + '"';
		};

		this.cmd = function(cmd, args)
		{
			//dbg('cmd = ' + cmd + ', args', args);

			if (!viewerApp)
			{
				cmdQueue.push({ cmd: cmd, args: args });
				return null;
			}

			switch (cmd)
			{
				case MapController.GetInviteProperties:
				{
					return this.getCurrentProperties(args);
				}

				case MapController.GetInviteProperty:
				{
					// args = { idProperty: name_of_property_to_retrieve
					//		  , idInvite:   glympse_invite_id --> can be null if first invite is targetted
					//		  }
					return this.getCurrentValue(args.idProperty, args.idInvite);
				}

				case r.setPadding:
				{
					if (!(args instanceof Array))
					{
						if (typeof args === 'number')
						{
							// Replicate old paddingLeft semantics for now
							args = [ null, null, null, args ];
						}
						else
						{
							return 'Invalid paddingArray type!';
						}
					}
				}

				default:
				{
					break;
				}
			}

			return viewerApp[cmd](args);
		};



		///////////////////////////////////////////////////////////////////////////////////
		// EVENT HANDLERS
		///////////////////////////////////////////////////////////////////////////////////

		function viewerInit(e)
		{
			//dbg('**** VIEWER INIT **** - viewerApp=' + e.detail.app);
			viewerElement.removeEventListener(glyEvents.INIT, viewerInit, false);
			controller.notify(m.ViewerInit, true);
		}

		function viewerReady(e)
		{
			//dbg('!!!!!!!! READY !!!!!!!!');
			viewerElement.removeEventListener(glyEvents.READY, viewerReady, false);

			viewerApp = e.detail.app;
			if (!viewerApp)
			{
				dbg('Error getting viewer. Aborting!');
				return;
			}

			// Process any queued commands issued before VIEWER_READY fired
			for (var i = 0; i < cmdQueue.length; i++)
			{
				var o = cmdQueue[i];
				that.cmd(o.cmd, o.args);
			}

			controller.notify(m.ViewerReady, viewerApp);

			// Notify if no invites found
			var invites = viewerApp.getInvites();
			if (!invites || invites.length === 0)
			{
				controller.infoUpdate(s.NoInvites, null, null, new Date().getTime(), true);
			}
		}

		function viewerData(e)
		{
			var detail = e.detail;
			var idInvite = (detail.id && lib.simplifyInvite(detail.id));
			var data = [];
			var ddata = detail.data || [];
			var owner = detail.owner;
			var i, ilen;

			for (i = 0, ilen = ddata.length; i < ilen; i++)
			{
				data.push($.extend({}, ddata[i]));
			}

			var unknowns = [];	// Unknown properties that are passed along

			if (!props[idInvite])
			{
				props[idInvite] = { };
				//console.log('New props for ' + idInvite);
			}

			var prop = props[idInvite];

			//console.log('DATA: ' + JSON.stringify(detail, null, '  '));

			for (i = 0, ilen = data.length; i < ilen; i++)
			{
				var val = data[i];
				var v = val.v;
				var n = val.n;
				var t = val.t;
				var found = false;

				for (var j = 0, jlen = propMap.length; j < jlen; j++)
				{
					var id = propMap[j];

					if (n === id)
					{
						found = true;
						if (prop[id] !== v)
						{
							val.n = undefined;
							prop[id] = val;
							//dbg('id=' + id + ', v', v);
							controller.infoUpdate(id, idInvite, owner, t, v);
							break;
						}
					}
				}

				// Check for additional processing
				if (n === s.InviteEnd)
				{
					notifyExpired(idInvite, owner);
				}

				if (!found)
				{
					unknowns.push(val);
					val = $.extend({}, val);
					val.n = undefined;
					prop[n] = val;
				}
			}

			if (unknowns.length > 0)
			{
				detail.data = unknowns;
				controller.notify(m.DataUpdate, detail);
			}

			//dbg('>>>> props["' + idInvite + '"]', prop);
		}

		function viewerEta(e)
		{
			var d = e.detail;
			var t = new Date().getTime();
			var idProp = s.Eta;
			var id = lib.simplifyInvite(d.id);
			var prop = props[id];
			var val = prop[idProp];

			if (!val)
			{
				val = {};
				prop[idProp] = val;
			}

			val[cEtaVal] = d.data * 1000;
			val[cEtaTime] = t;

			controller.infoUpdate(idProp, id, d.owner, t, val);
		}

		function viewerInviteAdded(e)
		{
			//dbg('InviteAdded', e.detail);
			e.detail.data = undefined;
			controller.notify(m.InviteAdded, e.detail);
		}

		function viewerInviteRemoved(e)
		{
			//dbg('InviteRemoved', e.detail);
			e.detail.data = undefined;
			controller.notify(m.InviteRemoved, e.detail);
		}

		function viewerInviteClicked(e)
		{
			//dbg('InviteClicked', e.detail);
			e.detail.data = undefined;
			controller.notify(m.InviteClicked, e.detail);
		}

		function viewerInviteError(e)
		{
			controller.notify(m.InviteError, e.detail);
		}

		function viewerOauthTokenError(e)
		{
			controller.notify(m.OauthError, e.detail);
		}


		///////////////////////////////////////////////////////////////////////////////////
		// INTERNAL
		///////////////////////////////////////////////////////////////////////////////////

		function notifyExpired(idInvite, owner)
		{
			if (timerEnd)
			{
				clearTimeout(timerEnd);
				timerEnd = 0;
			}

			var t = new Date().getTime();
			var stateExpired = s.Expired.toLowerCase();
			var prop = props[idInvite];
			var endTime = prop[s.InviteEnd].v;
			var propExpired = prop[stateExpired];
			var expired = (t >= endTime);

			if (!propExpired)
			{
				propExpired = { t: t, v: expired };
				prop[stateExpired] = propExpired;
			}

			propExpired.v = expired;

			// One last check
			if (!expired)
			{
				timerEnd = setTimeout(function()
				{
					notifyExpired(idInvite, owner);
				}
				, (endTime - t + 1000));

				return;
			}

			controller.infoUpdate(s.Expired, idInvite, owner, t, expired);
		}
	}

	MapController.GetInviteProperties = 'getInviteProperties';
	MapController.GetInviteProperty = 'getInviteProperty';


	module.exports = MapController;
});
