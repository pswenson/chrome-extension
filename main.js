// utility to get a dom element
const getElement = (elementId) => document.getElementById(elementId);

//todo bad user returns nothing, perhaps a user not found/auth error?

const http_request = (url, responseType) => {
  return new Promise( (resolve, reject) => {
    var req = new XMLHttpRequest();
    req.open('GET', url);
    req.responseType = responseType;

    req.onload = () => {
      var response = responseType ? req.response : req.responseXML;
      if (response && response.errorMessages && response.errorMessages.length > 0) {
        reject(response.errorMessages[0]);
        return;
      }
      resolve(response);
    };

    // Handle network errors
    req.onerror = () => {
      reject(Error("Network Error"));
    }
    req.onreadystatechange = () => {
      if (req.readyState == 4 && req.status == 401) {
        reject("You must be logged in to JIRA to see this project.");
      }
    }

    req.send();
  });
}

const loadSavedOptions = () => {
  chrome.storage.sync.get({
    project: 'Sunshine',
    user: 'nyx.linden'
  }, (items) => {
    getElement('project').value = items.project;
    getElement('user').value = items.user;
  });
}

//todo should these be constants?
// build the jira query
//todo ideally pass in values here instead of reading from document
const buildJQL = () => {
  const callbackBase = "https://jira.secondlife.com/rest/api/2/search?jql=";
  const project = getElement("project").value;
  const status = getElement("statusSelect").value;
  const inStatusFor = getElement("daysPast").value
  const jqlUrl = `${callbackBase}project=${project}+and+status=${status}+and+status+changed+to+${status}+before+-${inStatusFor}d&fields=id,status,key,assignee,summary&maxresults=100`;
  return jqlUrl;
}

// rename to build html results
const displayQueryResults = (response) => {
//todo parse the response + create HTML
// 
// Create HTML output to display the search results.
// results.json in the "json_results" folder contains a sample of the API response
// hint: you may run the application as well if you fix the bug. 
//
  //TODO consolidate with the feed response?
  const issues = response.issues;
  // is a for in or for of appropriate?
  var text = "";
  for (var issueCount = 0; issueCount < issues.length; issueCount++) {
    const issue = issues[issueCount];
    text +=  `<a href="${issue.self}">${issue.key}</a> | ${issue.fields.summary}  | <img src="${issue.fields.status.iconUrl}"><br/>`;
  }
  console.log("issues", issues);
  return `<p>${text}</p>`;
}

// utility 
const domify = (str) => {
  var dom = (new DOMParser()).parseFromString('<!doctype html><body>' + str, 'text/html');
  return dom.body.textContent;
}

const checkProjectExists = async () =>  {
  try {
    //todo the SUN project is hard-coded
    return await http_request("https://jira.secondlife.com/rest/api/2/project/SUN", "json");
    //todo force error and see what happens
  } catch (errorMessage) {
    setErrorMessage(errorMessage);
  }
}

const setStatusMessage = (message) => {
  getElement('status').innerHTML = message;
  getElement('status').hidden = false;
}

const setErrorMessage = (errorMessage) => {
  setStatusMessage(`ERROR: ${errorMessage}`);
}

/**
 * @param {string} searchTerm - Search term for JIRA Query.
 * @param {ß(string)} callback - Called when the query results have been
 *   formatted for rendering.
 * @param {function(string)} errorCallback - Called when the query or call fails.
 */
const getQueryResults = async (searchTerm, callback, errorCallback) => {
  try {
    var response = await http_request(searchTerm, "json");
    //todo this doesn't belong here, got back to getQueryResults caller and handle there
    callback(displayQueryResults(response));
  } catch (error) {
    errorCallback(error);
  }
}

const setupQueryHandler = () => {
//todo does this belong here or used by feed handler?
  getElement("query").onclick = () => {
    const jiraQueryUrl = buildJQL();
    setStatusMessage('Performing JIRA search for ' + jiraQueryUrl);
    // perform the search
    getQueryResults(jiraQueryUrl, (return_val) => {
      setStatusMessage('Query term: ' + jiraQueryUrl + '\n');
      // render the results
      var jsonResultDiv = getElement('query-result');
      jsonResultDiv.innerHTML = return_val;
      jsonResultDiv.hidden = false;
    },  (errorMessage) => {
      setErrorMessage(errorMessage);
    });
  }
}

const getJIRAFeed = (callback, errorCallback) => {
  var user = getElement("user").value;
  if (user == undefined) return;

  var url = `https://jira.secondlife.com/activity?maxResults=50&streams=user+IS+${user}&providers=issues`;
  http_request(url, "").then( (response) => {
    // empty response type allows the request.responseXML property to be returned in the makeRequest call
    callback(url, response);
  }, errorCallback);
}

const setupFeedHandler = () => {
  getElement("feed").onclick = () => {
    // get the xml feed
    getJIRAFeed( (url, xmlDoc) => {
      setStatusMessage('Activity query: ' + url + '\n');

      // render result
      var feed = xmlDoc.getElementsByTagName('feed');
      var entries = feed[0].getElementsByTagName("entry");
      var list = document.createElement('ul');

      for (var index = 0; index < entries.length; index++) {
        var html = entries[index].getElementsByTagName("title")[0].innerHTML;
        var updated = entries[index].getElementsByTagName("updated")[0].innerHTML;
        var item = document.createElement('li');
        item.innerHTML = new Date(updated).toLocaleString() + " - " + domify(html);
        list.appendChild(item);
      }

      var feedResultDiv = getElement('query-result');
      if (list.childNodes.length > 0) {
        feedResultDiv.innerHTML = list.outerHTML;
      } else {
        setStatusMessage('There are no activity results.');
      }

      feedResultDiv.hidden = false;

    }, (errorMessage) => {
      setErrorMessage(errorMessage);
    });
  };
}

// Setup
document.addEventListener('DOMContentLoaded', () => {
  // if logged in, setup listeners
  //TODO handle if project doesn't exist, show error message?

  checkProjectExists().then( () => {
    loadSavedOptions();
    setupQueryHandler();
    setupFeedHandler();
  }).catch( (errorMessage) => {
    setErrorMessage(errorMessage);
  });
});
