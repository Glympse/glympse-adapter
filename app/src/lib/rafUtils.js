define(function(require, exports, module)
{
	var w = window;
	var g = w.glympse;
	var glib = (g && g.lib);
	var initted = false;

	var performance = w.performance;

	/**
	 * Emulate window.setTimeout via RAF, if available. Polyfills to
	 * regular window.setTimeout if RAF is not available. Assumes RAF
	 * has already been polyfilled as necessary.
	 * @param   {function} fn    Callback with timeout is complete
	 * @param   {number}   delay Delay, in milliseconds
	 * @returns {object}   Timeout handle
	 */
	function rafSetTimeout(fn, delay)
	{
		if (!initted)
		{
			initted = true;
			var syncRaf = (glib && glib.syncRAF);	// FIXME: Should centralize syncRAF here as well?
			if (syncRaf)
			{
				syncRaf();
			}
		}

		var raf = w.requestAnimationFrame;
		if (!raf || !w.cancelAnimationFrame)
		{
			return w.setTimeout(fn, delay);
		}

		var handle = {};
		var targetTime = ((performance && performance.now()) || new Date().getTime()) + delay;

		function run(ctime)
		{
			if (!performance)
			{
				ctime = new Date().getTime();
			}

			if (ctime >= targetTime)
			{
				fn.call();
				return;
			}

			handle.raf = raf(run);
		}

		handle.raf = raf(run);
		return handle;
	}

	/**
	 * Emulate window.clearTimeout via RAF, if available. Polyfills to
	 * regular window.clearTimeout if RAF is not available. Assumes RAF has
	 * already been polyfilled as necessary.
	 * @param {object} handle Handle returned from window.rafTimeout
	 */
	function rafClearTimeout(handle)
	{
		if (handle && handle.raf)
		{
			w.cancelAnimationFrame(handle.raf);
		}
		else
		{
			w.clearTimeout(handle);
		}
	}

	/**
	 * Emulate window.setInterval via RAF, if available. Polyfills to
	 * regular window.setInterval if RAF is not available. Assumes RAF
	 * has already been polyfilled as necessary.
	 * @param   {function} fn    Callback with time interval is complete
	 * @param   {number}   delay Delay, in milliseconds
	 * @returns {object}   Timeout handle
	 */
	function rafSetInterval(fn, delay, handle)
	{
		if (!initted)
		{
			initted = true;
			var syncRaf = (glib && glib.syncRAF);
			if (syncRaf)
			{
				syncRaf();
			}
		}

		var raf = w.requestAnimationFrame;
		if (!raf || !w.cancelAnimationFrame)
		{
			return w.setInterval(fn, delay);
		}

		var start = delay + new Date().getTime();
		handle = handle || {};	// Update previous reference

		function run()
		{
			if (start <= new Date().getTime())
			{
				fn.call();
				rafSetInterval(fn, delay, handle);
				return;
			}

			handle.raf = raf(run);
		}

		handle.raf = raf(run);
		return handle;
	}

	/**
	 * Emulate window.clearInterval via RAF, if available. Polyfills to
	 * default window.clearInterval if RAF is not available. Assumes RAF has
	 * already been polyfilled as necessary.
	 * @param {object} handle Handle returned from window.rafInterval
	 */
	function rafClearInterval(handle)
	{
		if (handle && handle.raf)
		{
			w.cancelAnimationFrame(handle.raf);
		}
		else
		{
			w.clearInterval(handle);
		}
	}

	module.exports = {
		setTimeout: rafSetTimeout,
		clearTimeout: rafClearTimeout,
		setInterval: rafSetInterval,
		clearInterval: rafClearInterval
	};
});
