// -------- setup  load settings + register handlers -------- //

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


const setupQueryHandler = () => {
  getElement("query").onclick = () => {
    const jiraQueryUrl = buildJQL();
    setStatusMessage('Performing JIRA search for ' + jiraQueryUrl);
    clearResults();
    // perform the search
    getQueryResults(jiraQueryUrl, (html) => {
      renderQueryResults(html);
    },  (errorMessage) => {
      setErrorMessage(errorMessage);
    });
  }
}

const setupFeedHandler = () => {
  getElement("feed").onclick = () => {
    // get the xml feed
    getJIRAFeed( (url, xmlDoc) => {
      setStatusMessage('Activity query: ' + url + '\n');
      const html = buildFeedResultHtml(xmlDoc);
      renderQueryResults(html);
    }, (errorMessage) => {
      setErrorMessage(errorMessage);
    });
  };
}


const buildFeedResultHtml = (xmlFeedResults) => {
  //parse the xml feed
  const feed = xmlFeedResults.getElementsByTagName('feed');
  const entries = feed[0].getElementsByTagName("entry");
  const list = document.createElement('ul');

  // build html from xml feed
  for (var index = 0; index < entries.length; index++) {
    const html = entries[index].getElementsByTagName("title")[0].innerHTML;
    const updated = entries[index].getElementsByTagName("updated")[0].innerHTML;
    const item = document.createElement('li');
    item.innerHTML = new Date(updated).toLocaleString() + " - " + domify(html);
    list.appendChild(item);
  }
  // return empty string if no results
  const html = list.hasChildNodes() ? list.outerHTML : "";
  return html;
}

//todo change to <ul>
const buildTicketStatusQueryHtml = (response) => {
  const issues = response.issues;
  // is a for in or for of appropriate?
  var text = "";
  for (var issueCount = 0; issueCount < issues.length; issueCount++) {
    const issue = issues[issueCount];
    text +=  `<a href="${issue.self}">${issue.key}</a> | ${issue.fields.summary}  | <img src="${issue.fields.status.iconUrl}"><br/>`;
  }
  return `<p>${text}</p>`;
}

//todo evaluate breaking up into multiple files
//todo unit tests

// -------- utility functions -------- //
const domify = (str) => {
  var dom = (new DOMParser()).parseFromString('<!doctype html><body>' + str, 'text/html');
  return dom.body.textContent;
}

// utility to get a dom element
const getElement = (elementId) => document.getElementById(elementId);

//todo bad user returns nothing, perhaps a user not found/auth error?

const clearResults = () => {
  getElement('query-result').innerHTML = "";
}

const setStatusMessage = (message) => {
  getElement('status').innerHTML = message;
  getElement('status').hidden = false;
}

const setErrorMessage = (errorMessage) => {
  setStatusMessage(`ERROR: ${errorMessage}`);
}

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

const renderQueryResults = (html) => {
  clearResults();
  var jsonResultDiv = getElement('query-result');
  if (html == "") {
    setStatusMessage("No results");
    return;
  }
  jsonResultDiv.innerHTML = html;
  jsonResultDiv.hidden = false;
}


// -------- end utility functions -------- //

const loadSavedOptions = () => {
  chrome.storage.sync.get({
    project: 'Sunshine',
    user: 'nyx.linden'
  }, (items) => {
    getElement('project').value = items.project;
    getElement('user').value = items.user;
  });
}

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


const checkProjectExists = async () =>  {
  try {
    //todo the SUN project is hard-coded
    return await http_request("https://jira.secondlife.com/rest/api/2/project/SUN", "json");
    //todo force error and see what happens
  } catch (errorMessage) {
    setErrorMessage(errorMessage);
  }
}


/**
 * @param {string} searchTerm - Search term for JIRA Query.
 * @param {ß(string)} callback - Called when the query results have been
 *   formatted for rendering.
 * @param {function(string)} errorCallback - Called when the query or call fails.
 */
const getQueryResults = async (searchTerm, callback, errorCallback) => {
  try {
    const response = await http_request(searchTerm, "json");
    //todo this doesn't belong here, got back to getQueryResults caller and handle there
    callback(buildTicketStatusQueryHtml(response));
  } catch (error) {
    errorCallback(error);
  }
}

//todo  http_request handling should be consistent for getQueryResults + getJiraFeed

const getJIRAFeed = (callback, errorCallback) => {
  const user = getElement("user").value;
  if (user == undefined) return;

  const url = `https://jira.secondlife.com/activity?maxResults=50&streams=user+IS+${user}&providers=issues`;
  http_request(url, "").then( (response) => {
    // empty response type allows the request.responseXML property to be returned in the makeRequest call
    callback(url, response);
  }, errorCallback);
}



