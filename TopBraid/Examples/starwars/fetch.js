/**
 * A JavaScript that fetches all data about Humans, Droids and Starships from a GraphQL
 * service using the infamous Star Wars example.
 * The resulting JSON is sent to TopBraid and turned into RDF triples there.
 */


// Will contain the JSON of all fetched droids, by ID
var droids = {};

// Will contain the JSON of all fetched humans, by ID
var humans = {};


/**
 * First gets all "heros" from each known episode.
 * Then it fetches details about these Humans, including references to their friends.
 * For each friends it recursively gets all other friends until everything is loaded.
 */
function fetchAll() {
	
	// Fetch JSON, filling up the droids and humans objects above
	var episodes = [ "EMPIRE", "JEDI", "NEWHOPE" ];
	for(var i = 0; i < episodes.length; i++) {
		fetchHeroAndFriends(episodes[i]);
		fetchReviews(episodes[i]);
	}
	
	// Convert each JSON to RDF
	for(var id in droids) {
		convertToRDF(droids[id]);
	}
	for(var id in humans) {
		convertToRDF(humans[id]);
	}
}


function fetchHeroAndFriends(episode) {
	var queryString = "\
		query ($episode: Episode!) {\
			hero(episode: $episode) {\
				id\
			}\
		}";
	var variables = {
		"episode": episode
	};
	var json = query(queryString, variables);
	var heroId = json.hero.id;
	fetchHumanAndFriends(heroId);
}


function fetchHumanAndFriends(id) {
	if(humans.hasOwnProperty(id)) {
		// Already loaded
		return;
	}
	var queryString = "\
		query ($id: ID!) {\
			human(id: $id) {\
				id\
				appearsIn\
				friends {\
					id\
				}\
				height\
				homePlanet\
				mass\
				name\
				starships {\
					id\
					length\
					name\
				}\
			}\
		}";
	var variables = {
		"id": id
	};
	var json = query(queryString, variables);
	if(json.human) {
		humans[id] = json;
		var friends = json.human.friends;
		if(friends) {
			for(var i = 0; i < friends.length; i++) {
				fetchDroidAndFriends(friends[i].id); // Friend may be a droid
				fetchHumanAndFriends(friends[i].id);
			}
		}
	}
}


function fetchDroidAndFriends(id) {
	if(droids.hasOwnProperty(id)) {
		// Already loaded
		return;
	}
	var queryString = "\
		query ($id: ID!) {\
			droid(id: $id) {\
				id\
				appearsIn\
				friends {\
					id\
				}\
				name\
				primaryFunction\
			}\
		}";
	var variables = {
		"id": id
	};
	var json = query(queryString, variables);
	if(json.droid) {
		droids[id] = json;
		var friends = json.droid.friends;
		if(friends) {
			for(var i = 0; i < friends.length; i++) {
				fetchDroidAndFriends(friends[i].id);
				fetchHumanAndFriends(friends[i].id);
			}
		}
	}
}


/**
 * Fetches all reviews for a given Episode and converts them to RDF.
 * The resulting instances will be blank nodes because there is no real
 * way to construct a URI from them - the Review type does not even
 * contain a pointer at the Episode.
 * @param episode  the Episode (as a string)
 */
function fetchReviews(episode) {
	var queryString = "\
		query ($episode: Episode!) {\
			reviews(episode: $episode) {\
				commentary\
				stars\
			}\
		}";
	var variables = {
		"episode": episode
	};
	var json = query(queryString, variables);
	convertToRDF(json);
}


/**
 * Performs a given GraphQL query and returns the resulting JSON object.
 * @param queryString  the GraphQL query string
 * @param variables  the variables, as a JS object
 * @returns the JSON object response (top-level object)
 */
function query(queryString, variables) {
	TBS.log("Query " + queryString);
	TBS.log("Vars  " + JSON.stringify(variables));
	var json = SPARQL.function($data, "starwars-fetch:fetchJSON", queryString, JSON.stringify(variables));
	return JSON.parse(json.lex);
}


/**
 * Calls an SWP element that takes a JSON object and adds corresponding RDF triples
 * into the Star Wars Instances graph.
 * @param json  the JSON to add
 */
function convertToRDF(json) {
	TBS.log("To RDF " + JSON.stringify(json));
	SWP.element("starwars-fetch:convertToRDF", { json: JSON.stringify(json) });
}
