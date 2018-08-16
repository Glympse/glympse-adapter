module.exports = {
	dist : {
		src: ['<%= config.app %>/src/**/**.js'],
		options: {
			destination: 'docs'
		}
	}
};
