/*eslint-disable */
/* jscs:disable */
define(function (require, exports, module) {
	"use strict";
	function Logger() {
		this.enabled = false;
	}

	Logger.prototype = {
		enable: function () {
			this.enabled = true;
		},

		disable: function () {
			this.enabled = false;
		},

		log: function () {
			if (logger.enabled) {
				if (typeof console !== 'undefined' && typeof console.log === 'function') {
					console.log.apply(console, arguments);
				} else if (typeof console !== 'undefined' && typeof console.log === 'object') {
					// Log in IE
					try {
						switch (arguments.length) {
							case 1:
								console.log(arguments[0]);
								break;
							case 2:
								console.log(arguments[0], arguments[1]);
								break;
							default:
								console.log(arguments[0], arguments[1], arguments[2]);
						}
					} catch (e) {
					}
				}
			}
		}
	};

	var logger = new Logger();


	module.exports = logger;
});
/* jscs:enable */
/*eslint-enable */
