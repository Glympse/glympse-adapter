///////////////////////////////////////////////////////////////////////////////
// General utilities
///////////////////////////////////////////////////////////////////////////////

define(function(require, exports, module)
{
	var defCfg = '__gacfg';

	function returnVal(data, propId)
	{
		return function()
		{
			return (data && data[propId]);
		};
	}

	function returnDataStreamVal(data, propId)
	{
		return function()
		{
			var p = (data && data[propId]);
			return (p && (p.v || p));
		};
	}

	var localStorage = window.localStorage;

	// Simple lib export
	var utils =
	{
		dbg: function(id, minLevel)
		{
			return function(info, data, level)
			{
				// Never allow logging if minLevel < 0
				// Allow all logging if minLevel is !truthy
				// Otherwise, must match min level on a log request
				if (!minLevel || (minLevel >= 0 && level >= minLevel))
				{
					console.log('[' + id + '] ' + info
							 + (((data !== undefined) && (': ' + JSON.stringify(data, null, '  '))) || ''));
				}
			};
		}

		// Clone-ability status for a given value
		/*, canBeCloned: function(val)
		{
			if(Object(val) !== val) // Primitive value
			{
				return true;
			}

			var canBeCloned = utils.canBeCloned;
			switch({}.toString.call(val).slice(8,-1))
			{ // Class
				case 'Boolean':     case 'Number':      case 'String':      case 'Date':
				case 'RegExp':      case 'Blob':        case 'FileList':
				case 'ImageData':   case 'ImageBitmap': case 'ArrayBuffer':
					return true;
				case 'Array':       case 'Object':
					return Object.keys(val).every(prop => canBeCloned(val[prop]));
				case 'Map':
					return [...val.keys()].every(canBeCloned) && [...val.values()].every(canBeCloned);
				case 'Set':
					return [...val.keys()].every(canBeCloned);
				default:
					console.log('val: ' + val);
					console.log('bail: ' + {}.toString.call(val).slice(8,-1));
					return false;
			}
		}*/

		// Deep-copy an object, ensuring it is cloneable
		, generateClone: function(o)
		{
			if (!(o instanceof Object))
			{
				return o;
			}

			var ctor = o.constructor;
			if (ctor === Function)	// TODO: Catch other uncloneable object types
			{
				return null;
			}

			var clone = new ctor();
			for (var prop in o)
			{
				if (o.hasOwnProperty(prop))
				{
					clone[prop] = utils.generateClone(o[prop]);
				}
			}

			return clone;
		}

		, domain: window.location.hostname
		, getCookie: function(id)
		{
			if (localStorage)
			{
				var val = localStorage.getItem(id);

				// Some implementations have the localStorage interface available, but not
				// writable (i.e. iOS Safari), so need to fall through to cookie lookup just in case.
				if (val !== null)
				{
					return val;
				}
			}

			var cookies = document.cookie.split(';');

			for (var i = cookies.length - 1; i >= 0; i--)
			{
				var c = cookies[i];
				var idx = c.indexOf('=');
				var x = c.substr(0, idx);

				if (x.replace(/^\s+|\s+$/g, '') === id)
				{
					return window.decodeURIComponent(c.substr(idx + 1));
				}
			}

			return null;
		}

		, setCookie: function(id, val, daysExpire)
		{
			if (localStorage)
			{
				try
				{
					// Some implementations exception when localStorage is defined, but
					// not available (i.e. iOS Safari)
					localStorage.setItem(id, val);
					return;
				}
				catch (e)
				{
					console.log('localStorage error', e);
				}
			}

			var d = new Date();
			d.setTime(d.getTime() + (daysExpire || 365) * 24 * 3600 * 1000);
			document.cookie = id + '=' + val + '; expires=' + d.toGMTString() + '; domain=' + utils.domain + '; path=/';
		}

		, getCfgVal: function(propertyName, idCfg)
		{
			var config = utils.getCookie(idCfg || defCfg);
			return (config) ? (JSON.parse(config))[propertyName] : null;
		}

		, setCfgVal: function(propertyName, newValue, idCfg, daysExpire)
		{
			var id = idCfg || defCfg;
			var config = utils.getCookie(id);

			config = (config) ? JSON.parse(config) : {};
			config[propertyName] = newValue;

			utils.setCookie(id, JSON.stringify(config), daysExpire);
		}

		, capFirst: function(str)
		{
			return (str && (str.charAt(0).toUpperCase() + str.slice(1)));
		}

		, toUpperCamel: function(str)
		{
			var words = ((str && str.split('_')) || '');
			var out = '';

			for (var i = 0, len = words.length; i < len; i++)
			{
				out += utils.capFirst(words[i]);
			}

			return out;
		}

		, mapProps: function(targ, props, data, dataStreamProp)
		{
			for (var i = 0, len = props.length; i < len; i++)
			{
				var prop = props[i];
				targ['get' + utils.toUpperCamel(prop)] = (dataStreamProp) ? returnDataStreamVal(data, prop)
																		  : returnVal(data, prop);
			}
		}

		, simplifyInvite: function(invite)
		{
			return (invite && invite.toLowerCase().split('-').join('')) || '';
		}

		, normalizeInvite: function(invite)
		{
			if (invite)
			{
				invite = invite.toUpperCase();
				var ilen = invite.length;
				var ilen2 = ilen / 2;

				if (ilen === 6 || ilen === 8)
				{
					invite = invite.substr(0, ilen2) + '-' + invite.substr(ilen2, ilen2);
				}
			}

			return invite;
		}

		, cleanInvites: function(invites)
		{
			invites = invites || [];
			for (var i = 0, len = invites.length; i < len; i++)
			{
				invites[i] = utils.simplifyInvite(invites[i]);
			}

			return invites;
		}

	};


	module.exports = utils;
});
