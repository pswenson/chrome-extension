// utility to get a dom element
const getElement = (elementId) => document.getElementById(elementId);


function getJIRAFeed(callback, errorCallback) {
  var user = document.getElementById("user").value;
  if (user == undefined) return;

  var url = `https://jira.secondlife.com/activity?maxResults=50&streams=user+IS+${user}&providers=issues`;
  http_request(url, "").then(function (response) {
    // empty response type allows the request.responseXML property to be returned in the makeRequest call
    callback(url, response);
  }, errorCallback);
}

/**
 * @param {string} searchTerm - Search term for JIRA Query.
 * @param {function(string)} callback - Called when the query results have been
 *   formatted for rendering.
 * @param {function(string)} errorCallback - Called when the query or call fails.
 */
async function getQueryResults(searchTerm, callback, errorCallback) {
  try {
    var response = await http_request(searchTerm, "json");
    //todo this doesn't belong here, got back to getQueryResults caller and handle there
    callback(displayQueryResults(response));
  } catch (error) {
    errorCallback(error);
  }
}

function http_request(url, responseType) {
  return new Promise(function (resolve, reject) {
    var req = new XMLHttpRequest();
    req.open('GET', url);
    req.responseType = responseType;

    req.onload = function () {
      var response = responseType ? req.response : req.responseXML;
      if (response && response.errorMessages && response.errorMessages.length > 0) {
        reject(response.errorMessages[0]);
        return;
      }
      resolve(response);
    };

    // Handle network errors
    req.onerror = function () {
      reject(Error("Network Error"));
    }
    req.onreadystatechange = function () {
      if (req.readyState == 4 && req.status == 401) {
        reject("You must be logged in to JIRA to see this project.");
      }
    }

    req.send();
  });
}


function loadSavedOptions() {
  chrome.storage.sync.get({
    project: 'Sunshine',
    user: 'nyx.linden'
  }, function (items) {
    document.getElementById('project').value = items.project;
    document.getElementById('user').value = items.user;
  });
}

//todo should these be constants?
// build the jira query
//todo ideally pass in values here instead of reading from document
function buildJQL() {
  var callbackBase = "https://jira.secondlife.com/rest/api/2/search?jql=";
  var project = document.getElementById("project").value;
  var status = document.getElementById("statusSelect").value;
  var inStatusFor = document.getElementById("daysPast").value
  let jqlUrl = `${callbackBase}project=${project}+and+status=${status}+and+status+changed+to+${status}+before+-${inStatusFor}d&fields=id,status,key,assignee,summary&maxresults=100`;
  return jqlUrl;
}

// rename to build html results
function displayQueryResults(response) {
//todo parse the response + create HTML
// 
// Create HTML output to display the search results.
// results.json in the "json_results" folder contains a sample of the API response
// hint: you may run the application as well if you fix the bug. 
// 
  let issues = response.issues;
  // is a for in or for of appropriate?
  var text = "";
  for (var issueCount = 0; issueCount < issues.length; issueCount++) {
    let issue = issues[issueCount];
    text +=  `<a href="${issue.self}">${issue.key}</a> | ${issue.fields.summary}  | <img src="${issue.fields.status.iconUrl}"><br/>`;
  }
  console.log("issues", issues);

  return `<p>${text}</p>`;

}

// utility 
function domify(str) {
  var dom = (new DOMParser()).parseFromString('<!doctype html><body>' + str, 'text/html');
  return dom.body.textContent;
}


async function checkProjectExists() {
  console.log("HI!");
  try {
    //todo the SUN project is hard-coded
    return await http_request("https://jira.secondlife.com/rest/api/2/project/SUN", "json");
    //todo force error and see what happens
  } catch (errorMessage) {
    document.getElementById('status').innerHTML = 'ERROR. ' + errorMessage;
    document.getElementById('status').hidden = false;
  }
}

// Setup
//todo this function is way too big, break it up!
document.addEventListener('DOMContentLoaded', function () {
  console.log("DOM!");
  // if logged in, setup listeners
  //TODO handle if project doesn't exist, show error message?

  checkProjectExists().then(function () {
    loadSavedOptions();
    // query click handler
    document.getElementById("query").onclick = function () {
      // build query
      let jiraQueryUrl = buildJQL();
      document.getElementById('status').innerHTML = 'Performing JIRA search for ' + jiraQueryUrl;
      document.getElementById('status').hidden = false;
      // perform the search
      getQueryResults(jiraQueryUrl, function (return_val) {
        // render the results
        document.getElementById('status').innerHTML = 'Query term: ' + jiraQueryUrl + '\n';
        document.getElementById('status').hidden = false;

        var jsonResultDiv = document.getElementById('query-result');
        jsonResultDiv.innerHTML = return_val;
        jsonResultDiv.hidden = false;

      }, function (errorMessage) {
        document.getElementById('status').innerHTML = 'ERROR. ' + errorMessage;
        document.getElementById('status').hidden = false;
      });
    }

    // activity feed click handler
    document.getElementById("feed").onclick = function () {
      // get the xml feed
      getJIRAFeed(function (url, xmlDoc) {
        document.getElementById('status').innerHTML = 'Activity query: ' + url + '\n';
        document.getElementById('status').hidden = false;

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

        var feedResultDiv = document.getElementById('query-result');
        if (list.childNodes.length > 0) {
          feedResultDiv.innerHTML = list.outerHTML;
        } else {
          document.getElementById('status').innerHTML = 'There are no activity results.';
          document.getElementById('status').hidden = false;
        }

        feedResultDiv.hidden = false;

      }, function (errorMessage) {
        document.getElementById('status').innerHTML = 'ERROR. ' + errorMessage;
        document.getElementById('status').hidden = false;
      });
    };

  }).catch(function (errorMessage) {
    document.getElementById('status').innerHTML = 'ERROR. ' + errorMessage;
    document.getElementById('status').hidden = false;
  });
});
