'use strict';

const CAS = require('cas');
let cas = new CAS({
	base_url: 'https://login.umd.edu/cas',
	service: 'my_service',
	version: 3.0
});

exports.cas_login = function(req, res) {
	cas.authenticate(req, res, function(err, status, username, extended) {
		if (err) {
			// Handle the error
			res.send({error: err});
		} else {
			// Log the user in
			res.send({status: status, username: username, attributes: extended.attributes});
		}
	});
}