(function(w)
{
	var performance = w.performance;

	/**
	 * Emulate window.setTimeout via RAF, if available. Polyfills to
	 * regular window.setTimeout if RAF is not available. Assumes RAF
	 * has already been polyfilled as necessary.
	 * @param   {function} fn    Callback with timeout is complete
	 * @param   {number}   delay Delay, in milliseconds
	 * @returns {object}   Timeout handle
	 */
	w.rafTimeout = function(fn, delay)
	{
		var raf = w.requestAnimationFrame;
		if(!raf || !w.cancelAnimationFrame)
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
	};

	/**
	 * Emulate window.clearTimeout via RAF, if available. Polyfills to
	 * regular window.clearTimeout if RAF is not available. Assumes RAF has
	 * already been polyfilled as necessary.
	 * @param {object} handle Handle returned from window.rafTimeout
	 */
	w.clearRafTimeout = function(handle)
	{
		(handle && handle.raf) ? w.cancelAnimationFrame(handle.raf)
							   : w.clearTimeout(handle);
	};
})(window);
