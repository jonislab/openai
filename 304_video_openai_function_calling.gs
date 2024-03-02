var threadID="";
var assistantID= PropertiesService.getScriptProperties().getProperty("AssistantID");


function testGPTAssistant(){
  // This is a per user thread. Create it when the browser starts
  // Consider each browser refresh as a new thread  
  createThread();
  prompt="What is the latest stock price of Microsoft?";
  var res=gptConversation(prompt);
  Logger.log(getPrompt(res));
  Logger.log(getContentValue(res));
}

function gptConversation(prompt){
  // Add message to thread
  addMessageToThread(threadID,prompt);
  // Signal the Assistant to run the thread
  var runID = runAssistant(assistantID,threadID);

  // monitor the API status and run Function Calling if required
  // this is a blocking thread function
  monitorRunStatus(threadID,runID);
  
  // we are ready to read the response
  response=getAssistantResponse(threadID);
  //Logger.log(response);
  return response;
}

// This is a one time run to create OpenAI ChatGPT Assistant
function createAssistant(force){
  if (force){
    createStockBotWithFunction("MyStockBotAssistant"); 
    return;
  }
  if (assistantID){
    Logger.log("Assistant already exist");
  }
}
// STEP 1: Create the Assistant With Function Calling
function createStockBotWithFunction(assistantName){
  var prop = PropertiesService.getScriptProperties();
  var apiKey = prop.getProperty("OPENAI_API_KEY");
  var url = "https://api.openai.com/v1/assistants";

  var headers = {
    "Content-Type": "application/json",
    'Authorization': 'Bearer ' + apiKey,
    "OpenAI-Beta": "assistants=v1"
  };
  
  var payload = JSON.stringify({
    instructions: "1) You are designated exclusively as a stock price bot. 2) You must retrieve historical closing prices of the ticker through the external function if you do not have the data. 3) Obligatory Calculation Procedure: Calculate the polynomial regression with a degree of 2 using the data obtained from the external function, without fail. 4) Required Analysis: Analyze the most recent ticker price to determine whether it is lower or higher than the last regression value. This comparison is compulsory and must not be overlooked. 5) Mandatory Response Content: Your response must invariably include the name of the company and ticker symbol, last date, last price, and regression value. This information is critical and must be provided in every response. 6) Prohibited Explanations: Do not provide explanations about the regression calculation process. This information is to be omitted entirely from your responses.",
    "name": assistantName,
    tools: [{
        type: "function",
        function: {
          name: "getSymbolPriceHistory",
          description: "Get the historical data of the stock symbol",
          parameters: {
            type: "object",
            properties: {
              symbol: {type: "string", description: "The ticker symbol name of a company e.g. MSFT"}
            },
            required: ["symbol"]
          }
        }
      }],
    model: "gpt-4-turbo-preview"
  });
  
  var options = {
    "method" : "post",
    "headers": headers,
    "payload": payload,
    "muteHttpExceptions": true // Optional: set to true to prevent throwing exceptions on HTTP errors
  };
  
  var response = UrlFetchApp.fetch(url, options);
  var ret = response.getContentText()
  prop.setProperty("AssistantID", getId(ret));
  prop.setProperty("AssistantName", assistantName);  
  Logger.log("New Assistant created!");
  Logger.log(ret);
}


//STEP 2: create a Thread
function createThread() {
  var url = "https://api.openai.com/v1/threads";
  var apiKey = PropertiesService.getScriptProperties().getProperty("OPENAI_API_KEY");  

  var headers = {
    "Content-Type": "application/json",
    'Authorization': 'Bearer ' + apiKey,
    "OpenAI-Beta": "assistants=v1"
  };
  
  var options = {
    "method" : "post",
    "headers": headers,
    // Since the cURL command has an empty data (-d '') payload, we do not need to set a payload here.
    "muteHttpExceptions": true // Optional: set to true to prevent throwing exceptions on HTTP errors
  };
  
  var response = UrlFetchApp.fetch(url, options);
  var ret=response.getContentText();
  threadID=getId(ret);  
  Logger.log("Thread created!");
  Logger.log(ret);  
}


// STEP 3: Add message[s] to a thread
function addMessageToThread(thread,message) {
  var url = "https://api.openai.com/v1/threads/" + thread + "/messages";
  var apiKey = PropertiesService.getScriptProperties().getProperty("OPENAI_API_KEY");  

  // Replace 'your_openai_api_key_here' with your actual OpenAI API key
  var headers = {
    "Content-Type": "application/json",
    'Authorization': 'Bearer ' + apiKey,
    "OpenAI-Beta": "assistants=v1"
  };
  
  var payload = JSON.stringify({
    role: "user",
    content: message
  });

  var options = {
    "method": "post",
    "headers": headers,
    "payload": payload,
    "muteHttpExceptions": true // Optional: set to true to prevent throwing exceptions on HTTP errors
  };
  
  var response = UrlFetchApp.fetch(url, options);
  //Logger.log(response.getContentText());
  var ret = response.getContentText();
  Logger.log("Message added to thread!");
  Logger.log(ret);
}

// STEP 4:
function runAssistant(assistant,thread) {
  var apiKey = PropertiesService.getScriptProperties().getProperty("OPENAI_API_KEY");
  var threadId = 'thread_abc123'; // Replace with your actual thread ID
  var runsEndpoint = 'https://api.openai.com/v1/threads/' + thread + '/runs';

  var headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + apiKey,
    'OpenAI-Beta': 'assistants=v1'
  };

  var payload = {
    "assistant_id": assistant
  };
  /*var payload = {
    "assistant_id": assistant,
    "instructions": "1)Calculate the polynomial regression with degree of 2 from the data you received from external function; 2)Provide a brief response but always include the last date, last price, and the calculated last regression value; 3)Compare the last ticker price if below or above the last regression value; 4)Omit explanations about regression calculation"
  };
  */
  var options = {
    'method': 'post',
    'contentType': 'application/json',
    'headers': headers,
    'payload': JSON.stringify(payload)
  };

  var response = UrlFetchApp.fetch(runsEndpoint, options);
  var ret =response.getContentText();
  return getId(ret);
}

// STEP 5:
// returns the runID
function checkRunStatus(thread,run) {
  var apiKey = PropertiesService.getScriptProperties().getProperty("OPENAI_API_KEY")
  var runStatusEndpoint = 'https://api.openai.com/v1/threads/' + thread + '/runs/' + run;

  var headers = {
    'Authorization': 'Bearer ' + apiKey,
    'OpenAI-Beta': 'assistants=v1'
  };

  var options = {
    'method': 'get',
    'headers': headers
  };

  var response = UrlFetchApp.fetch(runStatusEndpoint, options);
  var ret=response.getContentText();
  Logger.log("run status is ...")
  Logger.log(getStatus(ret));
  return ret;
}

// STEP 6
function monitorRunStatus(threadID, runID) {
  // Initialize the status variable
  validRunStatus=["requires_action","in_progress","cancelling","completed","failed","cancelled","expired"];
  validRunSteps=["completed","failed","cancelled","expired"];
  var status = "in_progress";

  // Loop until there is reason to exit
  while (true) {
    var response = checkRunStatus(threadID, runID);
    status=getStatus(response); 
    Logger.log(status); 
    if (validRunStatus.includes(status)){
      switch (status){
        case "in_progress":
          Utilities.sleep(1500);
          continue;
        case "requires_action":
          var res=externalFunctionInvoker(threadID,runID,response);
          continue;
        case "completed":
          Logger.log("run status is complete!");
          return status;         
        default:
          // skipping handling of other statuses;
          return status;  
      }
    }
  }
}


// STEP 7
function submitStockBotResponse(threadId,runId,toolId, result) {
  var url = "https://api.openai.com/v1/threads/" + threadId + "/runs/"+ runId + "/submit_tool_outputs";
  var apiKey = PropertiesService.getScriptProperties().getProperty("OPENAI_API_KEY");
  var headers = {
    "Content-Type": "application/json",
    'Authorization': 'Bearer ' + apiKey,
    "OpenAI-Beta": "assistants=v1"
  };
    
  var payload = {
    tool_outputs: [{
      tool_call_id: toolId,
      output:JSON.stringify(result)
    }]
  };
  
  var options = {
    "method": "post",
    "headers": headers,
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true // Optional: set to true to prevent throwing exceptions on HTTP errors
  };
  
  var response = UrlFetchApp.fetch(url, options);
  Logger.log("Result from submitStockBotResponse");
  Logger.log(response.getContentText()) ;
  return response.getContentText();
}

// STEP 8
function getAssistantResponse(threadId) {
  var apiKey = PropertiesService.getScriptProperties().getProperty("OPENAI_API_KEY");
  var messagesEndpoint = 'https://api.openai.com/v1/threads/' + threadId + '/messages';
  var headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + apiKey,
    'OpenAI-Beta': 'assistants=v1'
  };
  var options = {
    'method': 'get',
    'headers': headers
  };

  var response = UrlFetchApp.fetch(messagesEndpoint, options);
  var ret = response.getContentText();
  Logger.log("Assistant response...");
  Logger.log(ret);
  return ret;
}

function getId(jsonString){
    // Parse the JSON string to an object
  var jsonObject = JSON.parse(jsonString);
  
  // Extract the id property from the parsed object
  return jsonObject.id;
}

function getStatus(jsonString){
    // Parse the JSON string to an object
  var jsonObject = JSON.parse(jsonString);
  
  // Extract the id property from the parsed object
  return jsonObject.status;
}

function getContentValue(response){
  var parsedData= JSON.parse(response);
  var res=parsedData.data[0].content[0].text.value;
  return res;
  }

function getPrompt(response){
  var parsedData= JSON.parse(response);
  var res=parsedData.data[1].content[0].text.value;
  return res;
  }

function getAssistantIdFromName(name){
  // assistant list is a JSON String
  assistantList=listAssistants();
  var dataObject = JSON.parse(assistantList);
  var aList=dataObject.data;
  var res="";
  for(var i=0;i<aList.length;i++){
    if(aList[i].name === name){
      res= aList[i].id;
      break;
    }
  }
  return res;
}

function externalFunctionInvoker(threadID,runID,jsonData){
  try {
    var parsedData = JSON.parse(jsonData);

    var submit_tool_outputs=parsedData.required_action.submit_tool_outputs;
    Logger.log(submit_tool_outputs); 
    var toolCalls = submit_tool_outputs.tool_calls;
    if (toolCalls && toolCalls.length > 0) {
      var firstToolCall = toolCalls[0];
      var arguments = JSON.parse(firstToolCall.function.arguments);
      var symbol = arguments.symbol;
      var funcName = firstToolCall.function.name;
      var funcID=firstToolCall.id;
      Logger.log("funcName=" + funcName + " Symbol=" + symbol + " id= " + funcID);
      if (funcName=="getSymbolPriceHistory"){
        // GPT doesn't actually care of the real name of the function
        var result=getDataFromYahoo([symbol],180);
        // the result is a two-dimensional data;
        var ret = submitStockBotResponse(threadID,runID,funcID,result);
        return ret;
      }
     } else {
      Logger.log("No tool calls found.");
    }
  } catch (error) {
    Logger.log("Error parsing JSON data: " + error);
  }
  // return nothing
}


function getStocksData() {

  var data = getDataFromYahoo(["MSFT"],180);
  //Logger.log("Type of variable: " + (typeof data));
  Logger.log(data)
}

// Symbols is an array of symbols
// The function only processRight
function getDataFromYahoo(symbols,noOfDays){
  var seriesData={};
 
  for (var i=0; i < symbols.length; i++){
    var url = createYahooURL(symbols,noOfDays);
    var historical=getStockHistoricalData(url);
    seriesData[symbols[i]]=historical
  }
  return seriesData;
}

// Example URL: https://ca.finance.yahoo.com/quote/AMZN/history?period1=1673127824&period2=1704663824&interval=1d&filter=history&frequency=1d&includeAdjustedClose=true
function getStockHistoricalData(url) {
  var ret={};
  // Fetch the data from the URL

  const response = UrlFetchApp.fetch(url);
  // parse CSV data
  var ret = Utilities.parseCsv(response.getContentText())
  return ret;

}

// DateString format:'2023-12-31T23:59:59'
function convertToEpochTime(dateTimeString) {
  var targetDate = new Date(dateTimeString);
  
  if (isNaN(targetDate.getTime())) {
    Logger.log('Invalid datetime format. Please provide a valid ISO datetime string.');
    return null;
  }
  var targetEpochTime = Math.floor(targetDate.getTime() / 1000); // Convert to seconds
  return targetEpochTime;
}


// Compose yahoo URL
function createYahooURL(symbol,noOfDays){
  var dateString = (new Date()).toString();
  var epoch2 = convertToEpochTime(dateString);
  var epoch1="";
  // set the end date next day of start date 
  var startDate=new Date(dateString);
  startDate.setDate(startDate.getDate() - noOfDays);
  epoch1=convertToEpochTime(startDate.toString());

  var url='https://query1.finance.yahoo.com/v7/finance/download/' + symbol +'?period1=' + epoch1 + '&period2=' + epoch2 +'&interval=1d&events=history&includeAdjustedClose=true'
  return url;
}