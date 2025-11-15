const fs = require('fs');
const path = require('path');
const os = require('os');

const SUBSCRIPTION_FILE = path.join(os.homedir(), '.my-vpn-subscriptions.json');

function loadSubscriptions() {
	try {
		if (fs.existsSync(SUBSCRIPTION_FILE)) {
			const data = fs.readFileSync(SUBSCRIPTION_FILE, 'utf-8');
			const parsed = JSON.parse(data);
			return Array.isArray(parsed) ? parsed : [];
		}
	} catch (e) {
		console.warn('Failed to load subscriptions:', e.message);
	}
	return [];
}

function saveSubscriptions(subscriptions) {
	try {
		fs.writeFileSync(SUBSCRIPTION_FILE, JSON.stringify(subscriptions, null, 2), 'utf-8');
		return true;
	} catch (e) {
		console.error('Failed to save subscriptions:', e.message);
		return false;
	}
}

function addSubscription(url) {
	const subscriptions = loadSubscriptions();
	if (!subscriptions.includes(url)) {
		subscriptions.push(url);
		saveSubscriptions(subscriptions);
		return true;
	}
	return false;
}

function removeSubscription(url) {
	const subscriptions = loadSubscriptions();
	const filtered = subscriptions.filter(s => s !== url);
	if (filtered.length !== subscriptions.length) {
		saveSubscriptions(filtered);
		return true;
	}
	return false;
}

function getAllSubscriptions() {
	return loadSubscriptions();
}

function clearSubscriptions() {
	saveSubscriptions([]);
}

module.exports = {
	loadSubscriptions,
	saveSubscriptions,
	addSubscription,
	removeSubscription,
	getAllSubscriptions,
	clearSubscriptions
};




