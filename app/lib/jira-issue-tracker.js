var $ = require('jquery');

var name = "JIRA";

var baseUrl = function () {
    var result = window.location.origin;
    if (AJS && AJS.params && AJS.params.baseURL) {
        result = AJS.params.baseURL;
    } else if ($("input[title='baseURL']") && $("input[title='baseURL']").val()) {
        result = $("input[title='baseURL']").val();
    }
    return result;
};

var isEligible = function () {
    return $("meta[name='application-name'][ content='JIRA']").length > 0;
};

var getSelectedIssueKeyList = function () {
    var selectedIssue;
    var selectedIssueMatch = document.URL.match(/.*selectedIssue=([^&]*).*/);
    if (selectedIssueMatch) {
        selectedIssue = document.URL.match(/.*selectedIssue=([^&]*).*/)[1];
    }

    var selectedIssues = $(`div.ibjHYw`)
               .map(function () {
                   let testIdString = $(this).parent().data("test-id").split(".");
                   return testIdString[testIdString.length-1];
               });
    return selectedIssues.length ? selectedIssues : selectedIssue ? [selectedIssue] : [];
};

var getIssueData = function (issueKey) {
    // https://docs.atlassian.com/jira/REST/latest/

    var urlAgile = baseUrl() + '/rest/agile/1.0/issue/' + issueKey + '?expand=renderedFields,names';
    var urlClassic = baseUrl() + '/rest/api/2/issue/' + issueKey + '?expand=renderedFields,names';

    //console.log("Issue: " + issueKey + " Loading...");
    return new Promise(function (fulfill, reject) {
        console.log("IssueUrl: " + urlAgile);
        $.getJSON(urlAgile).done(fulfill).fail(function () {
            console.log("IssueUrl: " + urlClassic);
            $.get(urlClassic).done(fulfill).fail(reject);
        });
    }).then(function (responseData) {
        //console.log("Issue: " + issueKey + " Loaded!");
        $.each(responseData.names, function (fieldKey, fieldName) {
            // try to fetch cutom fields
            if (fieldKey.startsWith("customfield_")) {
                if (!responseData.fields.estimate && ['storyPointEstimate', 'storyPoints', 'storyPunkte', 'backlogEstimate'].indexOf(fieldName.toCamelCase()) > -1) {
                    responseData.fields.estimate = responseData.fields[fieldKey];
                }
                if (!responseData.fields.epic && ['epicLink', 'eposVerknüpfung'].indexOf(fieldName.toCamelCase()) > -1) {
                    responseData.fields.epic = {};
                    responseData.fields.epic.key = responseData.fields[fieldKey];
                    responseData.fields.epic.name = "";
                }
            }
        });
        return responseData;
    });
};

var getCardData = function (issueKey) {
    var promises = [];
    var issueData = {};

    promises.push(getIssueData(issueKey).then(function (data) {
        var promises = [];
        issueData.key = data.key;
        issueData.type = data.fields.issuetype.name.toLowerCase();
        issueData.summary = data.fields.summary;
        issueData.description = data.renderedFields.description;
        issueData.labels = data.fields.labels || [];
        issueData.labels = issueData.labels.concat(data.fields.components.map(component => component.name));

        if (data.fields.assignee) {
            issueData.assignee = data.fields.assignee.displayName.replace(/\[[^[]*\]/, '');
            var avatarUrl = data.fields.assignee.avatarUrls['48x48'];
            if (avatarUrl) {
                issueData.avatarUrl = avatarUrl;
            }
        }

        if (data.fields.duedate) {
            issueData.dueDate = new Date(data.fields.duedate);
        }

        issueData.hasAttachment = data.fields.attachment ? data.fields.attachment.length > 0 : false;
        issueData.estimate = data.fields.estimate;

        if (data.fields.parent) {
            issueData.superIssue = data.fields.parent.key + ' ' + data.fields.parent.fields.summary;
        } else if (data.fields.epic && data.fields.epic.key) {
            issueData.superIssue = data.fields.epic.key + ' ' + data.fields.epic.name;
        }

        issueData.url = baseUrl() + "/browse/" + issueData.key;

        return Promise.all(promises);
    }));

    return Promise.all(promises).then(function () {
        return issueData;
    });
};

module.exports = {
    name: name,
    isEligible: isEligible,
    getSelectedIssueKeyList: getSelectedIssueKeyList,
    getCardData: getCardData,
    getIssueData: getIssueData
};
