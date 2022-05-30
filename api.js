/*Classes*/

class StatusFeed {
  constructor(rssUrl){
    let rssFeedArray = [];
    const rssFeed = XmlService.parse(UrlFetchApp.fetch(rssUrl).getContentText());
    const items = rssFeed.getRootElement().getChild('channel').getChildren('item');
    items.forEach(item => {
      const itemObject = {
        title:item.getChildText('title'),
        link:item.getChildText('link'),
        pubDate:item.getChildText('pubDate'),
        description:item.getChildText('description')
      };
      rssFeedArray = [...rssFeedArray,itemObject];
    });
    this._items = rssFeedArray;
    this._regexes = {
      investigating: 'investigating|issues?|delays|availability|incident|performance',
      identified: 'identified',
      watching: 'maintenance|informational|paused|scheduled',
      fixed: 'resolved|completed|normal\\supdate'
    };
  }
  get items(){
    return this._items;
  }
  get regexes(){
    return this._regexes
  }
  set regexes(rxObj){
    for(const [rxKey,rxString] of Object.entries(rxObj)) this._regexes[rxKey] = new RegExp(rxString,'i');
  }
  filterByHours(hours){
    this._items = this._items.filter(item => Math.abs(Date.now() - Date.parse(item.pubDate)) / (60 * 60 * 1000) <= hours);
  }
  filterByMinutes(minutes){
    this._items = this._items.filter(item => Math.abs(Date.now() - Date.parse(item.pubDate)) / (60 * 1000) <= minutes)
  }
  toIncidents(){
    let incidents = [];
    this.regexes = this._regexes;
    const {identified,watching,fixed} = this._regexes;
    this._items.forEach(statusItem => {
      const {title,description,pubDate} = statusItem;
      let status = 1;
      if(description.match(identified)) status = 2;
      if(title.match(watching)) status = 3;
      if(description.match(fixed)) status = 4;
      const incidentObject = {
        name:title,
        created_at:pubDate,
        message:description,
        visible:1,
        status:status
      };
      incidents = [...incidents,incidentObject];
    })
    return incidents;
  }
};

class EmailFeed {
  constructor(sender){
    let emailArray = [];
    const emails = GmailApp.getInboxThreads().map(thread => thread.getMessages()[0]).filter(message => message.getFrom().match(sender));
    emails.forEach(email => {
      const emailObject = {
        sender:email.getFrom(),
        subject:email.getSubject(),
        sent:`${email.getDate()}`,
        recipient:email.getTo(),
        body:email.getPlainBody()
      };
      emailArray = [...emailArray,emailObject];
    })
    this._emails = emailArray;
    this._regexes = {
      investigating: 'opened|acknowledged',
      identified: '',
      watching: '',
      fixed: 'closed'
    }
  }
  get emails(){
    return this._emails;
  }
  get regexes(){
    return this._regexes
  }
  set regexes(rxObj){
    for(const [rxKey,rxString] of Object.entries(rxObj)) this._regexes[rxKey] = new RegExp(rxString,'i');
  }
  filterByHours(hours){
    this._emails = this._emails.filter(email => Math.abs(Date.now() - Date.parse(email.sent)) / (60 * 60 * 1000) <= hours)
  }
  filterByMinutes(minutes){
    this._emails = this._emails.filter(email => Math.abs(Date.now() - Date.parse(email.sent)) / (60 * 1000) <= minutes)
  }
  toIncidents(){
    let incidents = [];
    this.regexes = this._regexes;
    const {fixed} = this._regexes;
    this._emails.forEach(email => {
      const {subject,sent,body} = email;
      let status = 1;
      if(subject.match(fixed)) status = 4;
      const incidentObject = {
        name:subject,
        created_at:sent,
        message:body,
        visible:1,
        status:status
      };
      incidents = [...incidents,incidentObject];
    })
    return incidents;
  }
};

/*Functions*/

//Parse file into HTML - used to separate inline css/js into separate files
const include = filename => HtmlService.createHtmlOutputFromFile(filename).getContent();

//Returns whether an incident was a certain amount of hours ago - used for filtering feeds
const wasHoursAgo = (pastDate,hours) => Math.abs(Date.now() - Date.parse(pastDate)) / (60 * 60 * 1000) <= hours;

//Fetches RSS feed and return extracted RSS items as array of objects
const fetchRssFeed = rssUrl => {
  let rssFeedArray = new Array;
  const rssFeed = XmlService.parse(UrlFetchApp.fetch(rssUrl).getContentText());
  const items = rssFeed.getRootElement().getChild('channel').getChildren('item');
  items.forEach(item => {
    const itemObject = {
      title: item.getChildText('title'),
      link: item.getChildText('link'),
      pubDate: item.getChildText('pubDate'),
      description: item.getChildText('description')
    };
    rssFeedArray = [...rssFeedArray,itemObject];
  });
  return rssFeedArray;
};

//Convert rss feed to incident output
const getIncidentsFromFeed = rssFeedArray => {
  let incidents = [];
  rssFeedArray.forEach(feedItem => {
    const {title,description,pubDate} = feedItem;
    let status = 2; //Default to identified
    if(title.match(/(maintenance|informational|paused)/i)) status = 3;
    else if (title.match(/investigating/i)) status = 1;
    if(description.match(/operational|resolved|restored|completed|normal\supdate/i)) status = 4;
    const incidentObject = {
      name:title,
      created_at:pubDate,
      message:description,
      visible:1,
      status:status
    };
    incidents = [...incidents,incidentObject];
  });
  return incidents;
};

const getEmails = senderEmail => {
  let emailArray = new Array;
  const emails = GmailApp.getInboxThreads().map(thread => thread.getMessages()[0]).filter(message => message.getFrom().match(senderEmail));
  emails.forEach(email => {
    const emailObject = {
      sender:email.getFrom(),
      subject:email.getSubject(),
      sent:`${email.getDate()}`,
      recipient:email.getTo(),
      body:email.getPlainBody()
    };
    emailArray = [...emailArray,emailObject];
  })
  return emailArray;
};

const getIncidentsFromEmails = emailArray => {
  let incidents = new Array;
  emailArray.forEach(email => {
    let {subject,sent,body} = email;
    subject = subject.replace("FW:","").replace("[EXTERNAL]","");
    body = body.replaceAll(/(<|\[)https?.+(>|\])/g,"");
    let status = 3;
    if(subject.match(/opened/i)) status = 2;
    else if(subject.match(/acknowledged/i)) status = 1;
    else if(subject.match(/closed/i)) status = 4;
    const incidentObject = {
      name:subject,
      created_at:sent,
      message:body,
      visible:1,
      status:status
    };
    incidents = [...incidents,incidentObject]
  })
  return incidents;
};

const vipStatus = {
  _status: "Operational",
  get status(){
    return this._status;
  },
  _components: {},
  get components(){
    return this._components
  },
  set status(statusFeed){
    statusFeed.forEach(statusItem => {
      const {title,link} = statusItem;
      const [component] = title.split(" - ");
      let componentStatus = 'Operational';
      if(!title.match(/Operational/)){
        this._status = 'Alert';
        componentStatus = 'Alert';
      };
      this._components[component] = link ? `<a href="${link}" target="_blank">${componentStatus}</a>` : componentStatus;
    })
  }
};

/*Trigger functions*/

const getStatusFeeds = () => {
  let platformKeys = PropertiesService.getScriptProperties().getProperties();
  let emailMessage =[];
  let incidentMessage;
  for(let [platform,platformKey] of Object.entries(platformKeys)){
    let statusFeed = platformKey.includes("@") ? new EmailFeed(platformKey) : new StatusFeed(platformKey);
    statusFeed.filterByMinutes(10);
    statusFeed.regexes = statusFeed.regexes;
    const {regexes} = statusFeed;
    statusFeed = statusFeed.items ? statusFeed.items : statusFeed.emails;
    if(platform.includes("VIP")) statusFeed = statusFeed.filter(item => !item.title.match(/Operational/));
    if(statusFeed.length === 0) continue;
    statusFeed.forEach(item => {
      if(item.title){
        if(item.title.match(regexes.investigating)) incidentMessage = `${item.title}\n${item.pubDate}\n${item.description}`;
      }else{
        if(item.subject.match(regexes.investigating)) incidentMessage = `${item.subject}\n${item.sent}\n${item.body}`;
      }
      emailMessage = [...emailMessage,incidentMessage];
    });
  };
  if(emailMessage.length > 0) GmailApp.sendEmail("dakota.whitney@nbcuni.com","ALERT - NEW INCIDENT FOUND",emailMessage.join(""))
};

const sendDailyReport = () => {
  let platformKeys = PropertiesService.getScriptProperties().getProperties();
  let htmlBody = `<h1>Ops Daily Incident Report</h1><h2>${new Date().toDateString()}</h2>`;
  let textBody = `Ops Daily Incident Report\n${new Date().toDateString()}\n`;
  for(let [platform,platformKey] of Object.entries(platformKeys)){
    let statusFeed = platformKey.includes("@") ? new EmailFeed(platformKey) : new StatusFeed(platformKey);
    statusFeed.filterByHours(24);
    statusFeed = statusFeed.toIncidents();
    if(platform.includes("VIP")) statusFeed = statusFeed.filter(incident => !incident.name.match(/Operational/));
    platform = platform.replaceAll(/_/g," ");
    let tableString,textString;
    const tableStyle = `style="text-align:left;border:1px solid black;padding:5px;"`
    if(statusFeed.length > 0){
      const rowStyle = `style="border:1px solid black;padding:5px;"`
      const rows = statusFeed.map(incident => `<tr><th ${rowStyle}>${incident.name}</th><td ${rowStyle}>${new Date(incident.created_at).toLocaleString({hour12:true})}</td><td ${rowStyle}>${incident.message}</td></tr>`).join('');
      const incidentText = statusFeed.map(incident => `\n${incident.name}\n${new Date(incident.created_at).toLocaleString({hour12:true})}\n${incident.message}\n`).join('');
      tableString = `<table ${tableStyle}><tr><th style="font-size:20px;padding:5px;">${platform}</th></tr>${rows}</table><br>`;
      textString = `${platform}\n${incidentText}`
    }else{
      tableString = `<table ${tableStyle}><tr><th style="font-size:20px;padding:5px;">${platform}</th></tr>No new incidents to report</table><br>`;
      textString = `${platform}\nNo new incidents to report`
    };
    htmlBody = htmlBody.concat(tableString);
    textBody = textBody.concat(textString);
  }
  GmailApp.sendEmail("NBCOTSOpsTeam@nbcuni.com",`Ops Daily Incident Report - ${new Date().toDateString()}`,textBody,{htmlBody:htmlBody})
};