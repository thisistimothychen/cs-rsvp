'use strict';

const CAS = require('cas');
let cas = new CAS({
	base_url: 'https://login.umd.edu/cas',
	service: 'my_service',
	version: 3.0
});

let path = require('path');
let User = require(path.resolve('./models/User'));


exports.cas_login = function(req, res) {
	cas.authenticate(req, res, function(err, status, cas_username, extended) {
		if (err) {	// Handle the error
			res.send({error: err});
		} else {		// Log the user in
			// Attempt to find user in database
			User.findOne({username: cas_username}, function(err, user) {
				if (!user) {
					// First login; render profile creation page
					req.session.cas_username = cas_username;	// Sets a cookie with user's info
					res.redirect('profile');
				} else {
					// User exists in database
					req.session.cas_username = cas_username;	// Sets a cookie with user's info
					res.redirect('/');
				}
			});
		}
	});
}


exports.cas_logout = function(req, res) {
	// req.session = null;				// Delete the cookie
	req.session.destroy();		// Delete the session
	
	//TODO fill third parameter with the redirect URL
	cas.logout(req, res, '', true);
}





// exports.cas_logout = function(req, res) {
// 	req.session.reset();			// Reset the session
// 	res.redirect('https://login.umd.edu/cas/logout');
// 	// res.send({status: status, username: username, attributes: extended.attributes});
// }