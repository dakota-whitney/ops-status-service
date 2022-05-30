//GET request
const doGet = e => {
  let output;
  if(!e.parameter.platform){
    if(e.parameter.view == "ops") output = HtmlService.createTemplateFromFile('all').evaluate();
    else output = HtmlService.createTemplateFromFile('public').evaluate();
    output.setFaviconUrl('https://raw.githubusercontent.com/dakota-whitney/ops-lighthouse-appsscript/main/img/favicon.png');
    output.setTitle('Ops Status Service');
    return output;
  };
  switch(e.parameter.platform){
    case "new_relic":
      output = new EmailFeed('alert@newrelic.com').toIncidents();
    break;
    case "vip":
      output = new StatusFeed('https://automatticstatus.com/rss').toIncidents();
    break;
    case "akamai":
      output = new StatusFeed('https://www.akamaistatus.com/history.rss').toIncidents();
    break;
    case "github":
      output = new StatusFeed('https://www.githubstatus.com/history.rss').toIncidents();
    break;
    case "sailthru":
      output = new StatusFeed('https://status.sailthru.com/rss').toIncidents();
    break;
    case "airship":
      output = new StatusFeed('https://status.airship.com/history.rss').toIncidents();
    break;
  }
  return ContentService.createTextOutput(JSON.stringify(output)).setMimeType(ContentService.MimeType.JSON);
};

//POST request
const doPost = e => {
  Logger.log(`A POST request was received`);
};

const getOtsIncidents = () => {
  Logger.log(UrlFetchApp.fetch('http://outages.otsops.com/api/v1/incidents').getContentText());
};

/*Status Page Functions*/

//Get all New Relic emails
const getNewRelicEmails = (hoursAgo = null) => {
  if(hoursAgo) return getEmails('alert@newrelic.com').filter(email => wasHoursAgo(email.sent,hoursAgo));
  else return getEmails('alert@newrelic.com');
};

//Fetches VIP RSS feed and returns extracted items as JSON
const fetchVipStatus = (hoursAgo = null) => {
  let vipStatusFeed = new StatusFeed('https://automatticstatus.com/rss');
  if(hoursAgo) vipStatusFeed = vipStatusFeed.filterByHours(hoursAgo);
  vipStatus.status = vipStatusFeed.items;
  return vipStatus;
};

const fetchAkamaiStatusFeed = (hoursAgo = null) => {
  const akamaiStatusFeed = new StatusFeed('https://www.akamaistatus.com/history.rss');
  if(hoursAgo) akamaiStatusFeed.filterByHours(hoursAgo);
  return akamaiStatusFeed;
};

//Fetches RSS feeds and returns extracted items as JSON
const fetchGithubStatusFeed = (hoursAgo = null) => {
  const githubStatusFeed = new StatusFeed('https://www.githubstatus.com/history.rss');
  if(hoursAgo) githubStatusFeed.filterByHours(hoursAgo);
  return githubStatusFeed;
};

const fetchSailthruStatusFeed = (hoursAgo = null) => {
  const sailthruStatusFeed = new StatusFeed('https://status.sailthru.com/rss');
  if(hoursAgo) sailthruStatusFeed.filterByHours(hoursAgo);
  return sailthruStatusFeed;
};

const fetchAirshipStatusFeed = (hoursAgo = null) => {
  const airshipStatusFeed = new StatusFeed('https://status.airship.com/history.rss');
  if(hoursAgo) airshipStatusFeed.filterByHours(hoursAgo);
  return airshipStatusFeed;
};