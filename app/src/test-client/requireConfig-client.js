/*globals require*/
require.config({
    shim: {

    },
    paths: {
        requirejs: '../../lib/requirejs/require',
        almond: '../../lib/almond/almond',
        UUID: '../../lib/UUID.js/dist/uuid.core',
        kamino: '../../lib/kamino.js/lib/kamino',
        MessageChannel: '../../lib/MessageChannel.js/lib/message_channel',
        oasis: '../common/oasis',
        rsvp: '../common/rsvp',
        'glympse-adapter': '../.',
		'src-client': 'src/.'
    },
    packages: [

    ]
});
require(['src/app']);
