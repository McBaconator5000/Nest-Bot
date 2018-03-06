const Discord = require('discord.js');
const config = require('./config.json')
const stringSimilarity = require('string-similarity');
const google = require('googleapis');
const ontime = require('ontime');
const authentication = require("./authentication");
const bot = new Discord.Client();

const googl = require('goo.gl');
googl.setKey(config.googlKey);

const botID = config.botID; 
const listID = config.listID;
const roleList = [
  "Pokémon Ranger",
  "Champion",
  "Veteran",
  "Elite Four",
  "Nest leader"
];
//make string here
const regex = /(\w|[)])+\s*(-)\s*\w+/;
var bigThanks = "**Big thanks to all the nest finders this rotation!** ";
const intro = bigThanks;
console.log("is work");

var keyPokes = []; //list of pokemon obj
var keyNests = []; //list of nest obj
var keyCount = []; //list of county obj 
var listChan = []; //list of channel obj
var allowedChan = [];

var channelID = "";
var mstHeader = "";
var runner = 0;
var colOrder = []; 
var bigList = [];
var newAdds = 0; //counter for when to refresh
const refreshNum = 10; //how many new info before refreshing

//this should refresh the list every day at 3am
ontime({
  cycle: [ '03:00:00' ]
 }, function (ot) {
  console.log("auto-refreshing the list");
  // do your job here
  //reset counter for auto-refresh
  newAdds = 0;
  //refresh the list
  authentication.authenticate().then((auth)=>{
    listBest(auth);
  });
  ot.done()
  return
});

authentication.authenticate().then((auth)=>{//run this function to pull columns (do first)
  fetchCol(auth);
});
authentication.authenticate().then((auth)=>{//run this function to pull all pokemon
  fetchPokes(auth);
});
authentication.authenticate().then((auth)=>{//run this function to pull all nests
  fetchNests(auth);
});
authentication.authenticate().then((auth)=>{//run this function to pull all counties and what channels to print to
  fetchCounty(auth);
});


function uniq(a) {
  var seen = {};
  return a.filter(function(item) {
      return seen.hasOwnProperty(item) ? false : (seen[item] = true);
  });
}
function capFirst(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}
function deleteRow(arr, row) {
  arr = arr.slice(0); // make copy
  arr.splice(row - 1, 1);
  return arr;
}
function sortRating(a, b) {
  column = getCol("rating", false);//hard-coded to sort rating column
  if (a[column] === b[column]) {
      return 0;
  }
  else { //find number of full stars (★) and if have more, put first
      return ((a[column].match(/★/g) || []).length > (b[column].match(/★/g) || []).length) ? -1 : 1;
  }
}
Date.prototype.stdTimezoneOffset = function() {
  var jan = new Date(this.getFullYear(), 0, 1);
  var jul = new Date(this.getFullYear(), 6, 1);
  return Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
}
Date.prototype.dst = function() {
  return this.getTimezoneOffset() < this.stdTimezoneOffset();
}
function getGetOrdinal(n) {
  var s=["th","st","nd","rd"],
      v=n%100;
  return n+(s[(v-20)%10]||s[v]||s[0]);
}

function fetchPokes(auth){
  var sheets = google.sheets('v4');
  sheets.spreadsheets.values.get({
    auth: auth,
    spreadsheetId: listID,
    range: 'AddtInfo!A2:D' 
  }, function(err, result){
    if(err){
      console.log(err);
    } else{
      var data = result.values;
      for(i = 0;i<data.length;i++){
        nicePokes = {
          "pokemon":data[i][0],
          "doesNest":data[i][1],
          "misc":data[i][2],
          "laterGen":data[i][3]
        };
        keyPokes.push(nicePokes);
      }
    }
  });
}
function fetchNests(auth){
  var sheets = google.sheets('v4');
  sheets.spreadsheets.values.get({
    auth: auth,
    spreadsheetId: listID,
    range: 'AddtInfo!F2:H' 
  }, function(err, result){
    if(err){
      console.log(err);
    } else{
      var data = result.values;
      var dummyArr = [];
      for(i = 0;i<data.length;i++){
        nickname = data[i][1];
        if(nickname == undefined){//no want undefined, blank is "better"
          nickname = " ";
        }
        parks = {
          "nest":data[i][0].toLowerCase(),
          "nickname":nickname.toLowerCase(),
          "isMarked": (data[i][2] == "TRUE")
        };
        keyNests.push(parks);
      }
    }
  });
  console.log("nests got");
}
function fetchCounty(auth){
  var sheets = google.sheets('v4');
  sheets.spreadsheets.values.get({
    auth: auth,
    spreadsheetId: listID,
    range: 'AddtInfo!J2:K' 
  }, function(err, result){
    if(err){
      console.log(err);
    } else{
      var data = result.values;
      var channels = [];
      for(i = 0;i<data.length;i++){
        builder = {
          "county":data[i][0],
          "channel":data[i][1]
        };
        keyCount.push(builder);
        channels.push(data[i][1]);
      }
      listChan = uniq(channels.toString().split(",").map(function(item){return item.trim()}));
    }
  });
}
function fetchCol(auth){
  var sheets = google.sheets('v4');
  sheets.spreadsheets.values.get({
    auth: auth,
    spreadsheetId: listID,
    range: 'Nest List!A1:X1'
  }, function(err, result){
    if(err){
      console.log(err);
    } else{
      var data = result.values;
      colOrder = String.prototype.toLowerCase.apply(data).split(",");
    }
  }); 
}
function fetchMaster(auth){
  //console.log("fetched master start");
  return new Promise(function(resolve, reject){
    var sheets = google.sheets('v4');
    var column = getCol(colOrder[colOrder.length-1],true);
    sheets.spreadsheets.values.get({
      auth: auth,
      spreadsheetId: listID,
      range: 'Nest List!A2:'+column
    }, function(err, result){
      if(err){
        console.log(err);
      } else{
        bigListTemp = result.values;
        mstHeader = bigListTemp[0][0];
        bigList = deleteRow(bigListTemp, 1);
        //console.log("fetched master end");
        resolve(bigList);
      }
    }); 
  });
}

function fetchThanks(auth, chat){
  console.log("fetching redone thanks");
  console.log(chat.id);
  
  var sheets = google.sheets('v4');
  sheets.spreadsheets.values.get({
    auth: auth,
    spreadsheetId: listID,
    range: 'Nest List!'+getCol("researcher", true)+'3:'+getCol("researcher", true)
  }, function(err, result){
    if(err){
      console.log(err);
    } else{
      rawfolks = result.values;//get all names
      printThanks(rawfolks, chat);      
      //
    }
  });
}

function printThanks(rawfolks, chat){
  //funtion to display thanks. 
  //console.log("printing thanks"+ chat.id);
  var members = chat.guild.members;

  if(rawfolks == undefined){//test to see if there are no researchers
    var strOne = "";
    var noHelp = true;
  }else{
    var strOne = rawfolks.toString();//put them all to string 
  }
  var folks = uniq(strOne.split(",").map(function(item){return item.trim()}));//put string back to array, while trimming spaces, also remove duplicates
  folks = folks.filter(function(names){return names.length > 0});//remove blank space "name"

  //clear this var
  bigThanks = intro;
  //for loop through folks


  for(i = 0; i < folks.length;i++){
    prtName = members.find("displayName", folks[i]);
    // need checker - if cannot find name - print regular displayName
    if(prtName == null){//check if on hippy channel
      prtName = folks[i]; //if not print out  string
      bigThanks = bigThanks + prtName + ", ";   
    }else{
      //print member links if can
      bigThanks = bigThanks + prtName + ", ";
    }
  }
  // trailing comma remover
  if(!noHelp){
    bigThanks = bigThanks.substring(0, bigThanks.length - 2);
  }
  listThanks(chat, bigThanks);
}
function listThanks(chat, bigThanks){
  var doExist = false;
  //want to edit the original message on the fly...
  
  //search messages for ones containing "intro"
  let messagecount = parseInt(50);      //amoutn of messages to check (set to high ???)
  chat.fetchMessages({limit: messagecount}).then(messages => { //get ^ amount of messages
    messages.filter(messChk => { //filter messages
      if (messChk.author.id == botID && messChk.content.includes(intro.trim())){ //filter by if from bot
        doExist = true;
        //console.log(bigThanks.length);
        if(messChk.content != bigThanks){//if it's the same, then don't do it
            messChk.edit(bigThanks);
          }
          if(bigThanks.length == intro.trim().length){//check if there was a reset (##should probably put elsewhere)
            messChk.delete(1000);
            doExist = false;
          }
        }
        return true;
      });
      return true;
    }).then(function() {//wait till search is done then print
      if(!doExist){
        chat.send(bigThanks);
      }     
    });
}

function displayList(districts, printdis, header, inHere){
  //console.log("printing list");
    //create embed text -use loop with lenght of districts- do add field for each district 
      // too much info for poor discord! Create new message for each district, print them all separately

      //run a test on printdis: if length > 1024 then proceed to split (split bigs)
      for(i = 0; i < printdis.length; i++){
        if(printdis[i].length > 1024){
          //string is too long. what do?
          var tooLong = printdis[i]; 
          var breaks = tooLong.match(/\n/g).length +1; //find out how many lines we have
          var bubbles = Math.ceil(tooLong.length / 1024); //find out how many times we need to divide it
          var ratio = Math.ceil(breaks/bubbles); // find out how many lines the new dividens have
          var appPrint = []; //temporoay arry to hold new park string
          var subtitles = []; // temporary array to hold new district string
          var tempArr = tooLong.split("\n"); //can do more with arrays than strings create array breaking at linebreaks (removes line breaks)
          for(j = 0; j < breaks; j = j + ratio){
            appPrint.push(tempArr.slice(j,j+ratio).toString().replace(/,/g,"\n")); //put line breaks back in while pushing divisions to temp array
          }
          for(k = 0; k < appPrint.length; k++){
            subtitles.push(districts[i] + " Part " + parseInt(k+1)); //do the same for districts but add word "Part 1,2 etc"
          }
          //splice new info into original array while deleting old values
          printdis.splice(i, 1, ...appPrint);
          districts.splice(i,1, ...subtitles);
        }
      }



      //run a second test on printdis: if printdis only contains 1 or 2 instances of "\n" then combine somehow
      //for loop, test if \n <= 2, test if next element exists, test if next element \n <=2 if all true splice
      for(i = 0;i < printdis.length; i++){
        if((printdis[i].match(/\n/g) || []).length <= 3){
          if(printdis[i+1]){
            if((printdis[i+1].match(/\n/g) || []).length <= 3){
              //console.log("can combine "+i);
              printdis.splice(i,2, printdis[i] + "\n" + printdis[i+1]);
              districts.splice(i, 2, districts[i] + " and "+ districts[i+1]);
            }
          }
        }
      }

     var chat = bot.channels.find("id", inHere);//can't do message.channel. Look up channel by id - saved at start of listener
  
     for(var k = 0; k < districts.length; k++){
       if(k == 0){
         chat.send("```" + header + "```");
       }
       var embed = new Discord.RichEmbed();

       if(k == (districts.length - 1)){//only set footer on last message
        embed.setFooter("Last Updated",null);
        embed.setTimestamp();
       }

       //the payload
       embed.addField("**__" + districts[k] + "__**",printdis[k],false);
       //send payload
       chat.send({ embed });
     }  
}

function getCol(header, isA1){
  //maybe call fetchCol here???
  for(i = 0; i < colOrder.length; i++){
    if(header == colOrder[i]){
      if(isA1){
        return String.fromCharCode(i+65);
      }else{
        return i;
      }
    }
  }
  return null; //no match found
}
function getEnd(title){
  if(title != undefined){
    //get end date
    var endDate = title.slice(title.indexOf("to ") + 3);
    //want to return time to nest rotation in smart way.
    //1  if >7 days away return "there are still undiscovered nests"
    //2  if <7 then return "there will be another migration on Wednesday -date- at -time-" 
    var month = endDate.slice(0,endDate.indexOf("/"));
    var day = endDate.slice(endDate.indexOf("/")+1,endDate.lastIndexOf("/"));
    var year = "20" + endDate.slice(endDate.lastIndexOf("/")+1);
    var ending = new Date(year+"-"+month+"-"+day);
    var today = new Date();
    var timeDiff = Math.abs(today.getTime() - ending.getTime());
    var dayDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

    if(dayDiff >= 7){
      var response =  "there are still undiscovered nests";
    }else{
      if(today.dst()){
        endTime = "7pm";
      }else{
        endTime = "6pm";
      }
      var response = "there will be another migration on Wednesday, the "+getGetOrdinal(day)+ " at " + endTime;
    }
    return response;

  }else{
    console.log("Cannot find date, data is undefined");
  }
}
function readMapBot(){
  //console.log("readMap start");
  return new Promise(function(resolve, reject){
    chat = bot.channels.find("id", "373874264664834048");
    chat.fetchMessages({limit: 5}).then(messages => { 
      for(msg of messages){
        actMess = msg.pop();
        glob = actMess.embeds.pop();
        if(glob != undefined){//ensure there are embeds
          boxes = glob.fields;
          //console.log(boxes);
          for(i = 0; i < boxes.length; i++){
            //create array here - then append to bigList
            if(boxes[i].value.includes("http") && !boxes[i].value.includes("thesilphroad")){//filter out text without nest info
              //console.log("name: "+boxes[i].name);
              parkDist = boxes[i].name;//boxes[i].name is district
              //console.log(boxes[i].value);
              fvParks = boxes[i].value.split("\n"); //parks now in array - go through array pushing each one to biglist
              //console.log(fvParks[0]);
              for(j = 0; j < fvParks.length; j++){
                isVer = "FALSE";
                //make all variables to put in bigList ##########will need adjusting if you ever add columns to the spreadsheet#####
                if(fvParks[j].includes("-")){
                  extraPoke = fvParks[j].substring(fvParks[j].indexOf("-")+1,fvParks[j].length).trim();
                  if(extraPoke.includes(":skull:")){
                    extraPoke = extraPoke.replace(":skull:", "");
                  }

                  if(extraPoke.includes("*")){//trim off bold formatting and/or unconfirmed marker
                      isVer = "TRUE";
                      parkPoke = extraPoke.replace(/[*]/g, "").trim();
                    }else if (extraPoke.toLowerCase().includes("(u)")){
                      isVer = "FALSE";
                      parkPoke = extraPoke.replace(/(\(U\))/gi, "").trim();
                    }else{
                      parkPoke = extraPoke;
                    }
                  starGex = /(★|☆){3}/;
                  if(starGex.test(extraPoke)){//figure out the rating
                      result = starGex.exec(extraPoke);
                      parkRat = result[0];
                    }else{
                      parkRat = "🤔";
                    }
                  pokeObj = getPoke(parkPoke);
                  if(pokeObj != undefined){
                    parkPoke = pokeObj.pokemon;
                  }
                }else{
                  parkPoke = ""; //look for "-" if none then "" else read after "-"
                }
                parkName = fvParks[j].substring(fvParks[j].indexOf("[") + 1,fvParks[j].indexOf("]")); //what is in []
                parkRes = "MapBot";        
                ender = fvParks[j].indexOf(">") == -1 ? fvParks[j].indexOf(")") : fvParks[j].indexOf(">");//in case a ">"" is dropped
                parkLink = fvParks[j].substring(fvParks[j].indexOf("<") + 1,ender); //what is in <>
                //parkDist = boxes[i].name;//boxes[i].name is district
                dummyNum = 0;
                //dummyNum = 0;
                parkNick = ""; //nickname for park - not needed
                parkCounty = "Fox Valley";
  
                
                //need way to order this based on columns...######
                builder = [parkPoke, parkName, isVer, parkRes, parkRat, parkLink, parkDist, dummyNum, dummyNum, parkNick, parkCounty];
                
                if(parkPoke != ""){
                  //console.log(parkPoke + " added at " + parkName);
                  bigList.push(builder);
                  //console.log("biglist lemgth: at read "+ bigList.length);
                  
                }
              }
            }
          }
        }
      }
      //console.log("readMap end");// $$$
      var d = new Date();
      var n = d.toTimeString();
      //console.log("length after add "+bigList.length + " @ " + n); //$$$must be run 1st 
      resolve(bigList);   
    });
  });
}


function findPoke(pokemon, noFilter){
  if(bigList.length > 0){//ensure that data pulled properly
    var chat = bot.channels.find("id", channelID);//can't do message.channel. Look up channel by id - saved at start of listener
    var results = []; //empty array of all findings
    var pcolumn = getCol("pokemon",false);//only call getCol once, much faster
    var ccolumn = getCol("county", false);

    for(i = 0; i < bigList.length; i++){
      if(bigList[i][pcolumn].toLowerCase() == pokemon){
        //put filter here
        //get allowed infor From keyCount
        //if keycount.channel contains channel id, then okay!
        foundObj = keyCount.filter(cnt => cnt.county == bigList[i][ccolumn]).pop();
        if(foundObj != undefined){
          allowedChan = foundObj.channel.split(", ");
        }
        //get list of all channels on server, if there are similarities b/w it and allowedChan, then approve it
        if(chat.guild.channels.keyArray().some(r => allowedChan.indexOf(r) >= 0)||
           bigList[i][ccolumn] == "Fox Valley" ||
            noFilter){//FV nests printed regardless => cannot modify keyCOunt as then it would print FV nests
          results.push(bigList[i]);
        }
      }
    }
    //see if any results were found
    if(results.length == 0){
      //could not find anything
      var response = "I'm not aware of any nests that spawn "+capFirst(pokemon)+", but "+getEnd(mstHeader);
    }else{
      // organize results by star rating
      results.sort(sortRating);
      // then sort by county as we will split answer by it
      //unneeded?
      results.sort(function (a,b){
        column = getCol("county", false);
        if(a[column] === b[column]){
          return 0;
        }else{
          return a[column] > b[column] ? 1 : -1;
        }
      });

      if(results.length == 1){
        var response = "There is 1 nest spawning "+capFirst(pokemon);
      }else{//singular vs plural handler
        var response = "There are "+results.length+" nests spawning "+capFirst(pokemon) + " in ";
      }
      var scolumn = getCol("rating",false);
      var lcolumn = getCol("location", false);
      var gcolumn = getCol("google maps", false);
      
      for(j = 0;j < results.length; j++){
        var countVarea = results[j][ccolumn] == "Fox Valley" ? " Area" : " County";
        if(j > 0 && results[j][ccolumn] != results[j-1][ccolumn]){
          response = response + "\n**__" + results[j][ccolumn] + countVarea + "__**";
        }else if(j == 0){
          response = response + "\n**__" + results[j][ccolumn] + countVarea + "__**";
        }
        response = response + "\n  " + results[j][lcolumn] +" - "+ results[j][scolumn] + " - <" + results[j][gcolumn]+">";
      }
    }
    var d = new Date();
    var n = d.toTimeString();
    //console.log("length at print "+bigList.length + " @ " + n); //$$$must be run 1st
    //console.log("printed");
    chat.send(response);
   


  }else{
    console.log("failed to load list");
  }
}
function clearList(channel){
  let messagecount = parseInt(100);      //amoutn of messages to check (set to high ???)
  channel.fetchMessages({limit: messagecount}).then(messages => { //get ^ amount of messages
    messages.filter(messChk => { //filter messages
      if (messChk.author.id == botID){ //filter by if from bot
        if(!messChk.content.includes(intro)){
          messChk.delete(); //if from bot. do thing
        }
      }

    });
  }); 
}

bot.on('message', (message) => {
  //message.react("🍤");
  if(message == "!refresh"){
    if(autoconfirm(message.member.roles)){//only ppl with instant invite ability allowed to run code
      channelID = message.channel.id;
      
      authentication.authenticate().then((auth)=>{
        listBest(auth);
      });
      
      //delete message for better cleanup
      message.delete(2000);

    }else{
      message.channel.send("you do not have permission to use this function")
    }  
  }else if (message == "!print"){//pretend print nest list

    var embed = new Discord.RichEmbed();
    embed.addField("Park","[Voyager Park](https://goo.gl/maps/tMypUjSh1zw)");
    message.channel.send({ embed });
  }else if ((message.content.includes("★") || message.content.includes("☆")) && message.author.id != botID){
    console.log(message.author.id);
    message.channel.send("Please refrain from rating nests here. I can only understand pokemon names and nests. If you would like to rate a nest, please use #nest_chat.")
  }else if(message.content.startsWith("!nick")){//from bot get guildmember to change nickname 
    newName = message.content.slice(message.content.indexOf(" "), message.content.length);
    if(newName.length <= 1){
      newName = "Nest-bot";
    }

    if(newName.length > 32){ //check length of new name
      console.log(newName + " is too long.");
    }else{
      message.guild.members.get(bot.user.id).setNickname(newName).catch(err => console.log(err));//if error allow for delete message
    }
    message.delete(2000);
  }else if(regex.test(message.content) && message.author.id != botID ){//testing to match nest submission syntax
    
     //testing update ability
      //done 1. check if user has at least 1 role
      //done  2. check if pokemon exists
      //done  3. check if nest exists
      //done  4. update proper cell (will have to read first, then update :/ )
      //done  5. store username of person who provided update. (new column)
    newInfo = message.content;

    //trim off info after !from and or suspected
    if(newInfo.includes("!from") || newInfo.includes("suspected")){
      parkEnd = newInfo.indexOf("!from") > newInfo.indexOf("suspected") ? newInfo.indexOf("!from") : newInfo.indexOf("suspected");
     }else{
      parkEnd = newInfo.length;
    }
    
    //should be pokemon - park
    nestPoke = newInfo.slice(0,newInfo.indexOf("-")).trim().toLowerCase();//find what pokemon they report
    nestPark = newInfo.slice(newInfo.indexOf("-")+1,parkEnd).trim().toLowerCase();//find what nest they report

    //console.log(nestPoke);
    //console.log(nestPark);

    //get pokemon 
    pokemon = getPoke(nestPoke);
    nest = getPark(nestPark);
    
    if(nest == undefined && pokemon == undefined){
      incubator = nestPark;
      nestPark = nestPoke;
      nestPoke = incubator;
      //just in case they do it backwards
      pokemon = getPoke(nestPoke);
      nest = getPark(nestPark);
    }
    
    //console.log(nest);

    if(nest != undefined && pokemon != undefined){
      
      if(pokemon.doesNest == "FALSE"){//check to make sure pokemon can nest
        message.channel.send("I don't believe this pokemon can nest. Please message "+message.guild.members.find("displayName", "McBaconator5000")+
        " if you have proof that "+capFirst(pokemon.pokemon) +" is, indeed, nesting.");
      }else if(nest.isDup){
        var matches = keyNests.filter(n => n.nest === nest.nest);
        var possibles = matches.map(n => n.nickname);
        var options = " ";
        for(i = 0; i < possibles.length; i++){
          options = options + possibles[i] + ", ";
        }
        result = options.slice(0,options.length - 2);
        message.channel.send("There are several parks by that name. Please re-enter your report using one of the following names" + result+".");
      }else{
        goodCall(nest, pokemon.pokemon, message);
      }

    }else if(nest == undefined && pokemon == undefined){
      //could not find either pokemon or nest, even after switching
      //do nothing if just said nest-bot
      if(!(nestPark.slice(nestPark.length - 4, nestPark.length) == "nest" && nestPoke.slice(0, 3) == "bot")){
        message.channel.send("I have no idea what you are trying to tell me.");
        //message.react("❔");
      }
    }else if(nest == undefined){
      message.channel.send("I don't think I've heard of the nest: " + nestPark);
      //message.react("🤖");
    }else if(pokemon == undefined){
      message.channel.send("I'm not aware of the Pokemon: " + nestPoke);  
      //message.react("🤔");         
    }       
  }else if(message.content.startsWith("!play")){
    newGame = message.content.slice(message.content.indexOf(" ")+1, message.content.length);
    if(newGame.length <= 1 || newGame.length >= 32){
      //bot.user.setGame(newGame);
    }else{
      bot.user.setGame(newGame);
    }
    message.delete(2000);
  }else if(message == "!clear"){
    if(message.member.hasPermission("CREATE_INSTANT_INVITE")){//only ppl with instant invite ability allowed to run code
      clearList(message.channel);
      message.delete(2000);
    }
  }else if(message.content.startsWith("!findall")){

    var queryPoke = message.content.slice(message.content.indexOf(" ")+1, message.content.length).toLowerCase();
    //get pokemon object
    pokemon = getPoke(queryPoke);

    if(pokemon != undefined){//found

      if(pokemon.doesNest == "TRUE"){//see if species is known to nest
        //fetch all data
        authentication.authenticate().then((auth)=>{//run this function to pull all data (will need to check against it)
          fetchMaster(auth).then(function (fulfilled){
            readMapBot().then(function (fulfilled){
              channelID = message.channel.id;
              findPoke(pokemon.pokemon, false);
            });
          });
        });
      }else if(pokemon.misc == "" || pokemon.misc == undefined || pokemon.misc == " "){
        message.channel.send(capFirst(pokemon.pokemon)+" is not known to nest.");        
      }else{
        message.channel.send(capFirst(pokemon.pokemon)+" doesn't nest, but it can be found "+pokemon.misc);
      }
    }else{
      message.channel.send("I'm not aware of the pokemon: "+queryPoke);
    }
  }else if(message.content.startsWith("!find")){
    var queryPoke = message.content.slice(message.content.indexOf(" ")+1, message.content.length).toLowerCase();
    //get pokemon object
    pokemon = getPoke(queryPoke);

    if(pokemon != undefined){//found

      if(pokemon.doesNest == "TRUE"){//see if species is known to nest
        //fetch all data
        authentication.authenticate().then((auth)=>{//run this function to pull all data (will need to check against it)
          fetchMaster(auth).then(function (fulfilled){
            readMapBot().then(function (fulfilled){
              channelID = message.channel.id;
              findPoke(pokemon.pokemon, false);
            });
          });
        });
      }else if(pokemon.misc == "" || pokemon.misc == undefined || pokemon.misc == " "){
        message.channel.send(capFirst(pokemon.pokemon)+" is not known to nest.");        
      }else{
        message.channel.send(capFirst(pokemon.pokemon)+" doesn't nest, but it can be found "+pokemon.misc);
      }
    }else{
      message.channel.send("I'm not aware of the pokemon: "+queryPoke);
    }
  }else if(message.content.startsWith("!check")){
    testStr = message.content.slice(message.content.indexOf(" ")+1, message.content.length);

    resp = getPark(testStr);
    //console.log(resp);
    //console.log("length = "+keyNests.length);
    if(resp != undefined && resp.isDup){
      message.channel.send("There are several parks by that name, please be more specific");
    }else if(resp != undefined){//nest exists, find it on biglist
      //fetch all data
      authentication.authenticate().then((auth)=>{//run this function to pull all data (will need to check against it)
        fetchMaster(auth).then(function (fulfilled){
          readMapBot().then(function (fulfilled){
            printPark(message);
          });
        });
      });
    }else{
      message.channel.send("I cannot understand that");
    }

  }else if(message.content.startsWith("!poke")){
    testStr = message.content.slice(message.content.indexOf(" ")+1, message.content.length);

    authentication.authenticate().then((auth)=>{//run this function to pull all nests
      fetchPokes(auth);
    }).then(()=>{
      resp = getPoke(testStr);
      if(resp != undefined){
        message.channel.send("I'm interpretting that as: "+resp.pokemon);
      }else{
        message.channel.send("I cannot understand that");
      }
    });
  }else if(message.content.startsWith("!thank")){
    testStr = message.content.slice(message.content.indexOf(" ")+1);
    chat = message.channel;
    authentication.authenticate().then((auth)=>{
      fetchThanks(auth, chat);
    });
  }else if(message.content.startsWith("!test")){
    testStr = message.content.slice(message.content.indexOf(" ")+1, message.content.length);
    console.log(message.channel.id);
    
    //console.log(getPark(testStr));
    //console.log(message.guild.channels.filterArray(channel => listChan.includes(channel.id)).pop());
    //console.log("#" + message.guild.members.find("displayName", "Borno") +"#");
    googl.expand('https://goo.gl/maps/34fAxJV4nVp')
    .then(function (longUrl) {
        console.log(longUrl);
    })
    .catch(function (err) {
        console.error(err.message);
    });

  }else if(message.content == "!iphone"){
    //fetch all data
    authentication.authenticate().then((auth)=>{//run this function to pull all data (will need to check against it)
      fetchMaster(auth).then(function (fulfilled){
          printList(message);
      });
    });
  }else if(message.content == "!read"){
    //readMapBot();
   //console.log(keyNests[21]);
  }else if(message.content.startsWith("!survey")){
    testStr = message.content.slice(message.content.indexOf(" ")+1, message.content.length);
    resp = getPark(testStr);
    //console.log(resp);
    //console.log("length = "+keyNests.length);
    if(resp != undefined && resp.isDup){
      var matches = keyNests.filter(n => n.nest === resp.nest);
      var possibles = matches.map(n => n.nickname);
      var options = " ";
      for(i = 0; i < possibles.length; i++){
        options = options + possibles[i] + ", ";
      }
      result = options.slice(0,options.length - 2);
      message.channel.send("There are several parks by that name. Please re-enter your report using one of the following names" + result+".");

      //message.channel.send("There are several parks by that name, please be more specific");
    }else if(resp != undefined){//nest exists, find it on biglist
      //fetch all data
      authentication.authenticate().then((auth)=>{//run this function to pull all data (will need to check against it)
        fetchMaster(auth).then(function (fulfilled){
          readMapBot().then(function (fulfilled){
            printEmbedPark(message);
          });
        });
      });
    }else{
      message.channel.send("I cannot understand that");
    }
  }
});//end message listener  

function printList(message){
  if(bigList.length < 1){
    console.log("failed to load list")
  }else{
    lcolumn = getCol("location", false);
    gcolumn = getCol("google maps", false);
    dcolumn = getCol("district", false);
    ccolumn = getCol("county", false);
    phoneList = [];
    noFilter = false; //have noFilter abiilty later####

    //go through biglist make objects with county, district, nest name and google map
    for(i = 0; i < bigList.length; i++){
      //put filter here
      //get allowed infor From keyCount
      //if keycount.channel contains channel id, then okay!
      foundObj = keyCount.filter(cnt => cnt.county == bigList[i][ccolumn]).pop();
      if(foundObj != undefined){
        allowedChan = foundObj.channel.split(", ");
      }
      //get list of all channels on server, if there are similarities b/w it and allowedChan, then approve it
      if(message.channel.guild.channels.keyArray().some(r => allowedChan.indexOf(r) >= 0) || noFilter){
        constructor = {
          "location" : bigList[i][lcolumn],
          "gmap": bigList[i][gcolumn],
          "district":bigList[i][dcolumn],
          "county":bigList[i][ccolumn]
        }
        phoneList.push(constructor);
      }
    }
    //list contructed with filtered results.
    phoneList.sort(function(a, b){
      var cntyA = a.county.toUpperCase();
      var cntyB = b.county.toUpperCase();
      var distA = a.district.toUpperCase();
      var distB = b.district.toUpperCase();
      //organize by county    
      if(cntyA == cntyB){
        //then sort by disctrict
        return (distA < distB) ? -1 : (distA > distB) ? 1 : 0;
      }else{
        return (cntyA < cntyB) ? -1 : 1;
      }
    }); 

    //console.log(phoneList);
    
    //make presentable list
    //find all counties, divide output by them
    if (phoneList.length == 0){
      message.channel.send("I could not find any nests to print");
    }else{
      for(i = 0; i < phoneList.length; i++){
        if(i == 0){
          currCounty = phoneList[0].county;
          output = "```"+ currCounty + " County```";
          output = output +"__**"+ phoneList[i].district + "**__\n";
          output = output + "" + phoneList[i].location + " - <" + phoneList[i].gmap +">";
        }else if(currCounty == phoneList[i].county){
          //keep contructing
          if(phoneList[i].district != phoneList[i-1].district){
            output = output +"\n__**"+ phoneList[i].district + "**__";
          } 
          output = output + "\n" + phoneList[i].location + " - <" + phoneList[i].gmap +">";
        }else if(currCounty != phoneList[i].county){
          //print new header
          currCounty = phoneList[i].county;
          output = output + "\n ```"+ currCounty + " County```";
          if(phoneList[i].district != phoneList[i-1].district){
            output = output +"\n__**"+ phoneList[i].district + "**__";
          }
          output = output + "\n" + phoneList[i].location + " - <" + phoneList[i].gmap +">";
        }
      }
      //message.channel.send(output); 
      //output will for sure be way too big. find out how many times 900 goes into output.length
      //that will be how many times we split.
      //for that amount .send 
      const maxChar = 900;
      divisions = Math.ceil(output.length / maxChar);
      firstPos = 0;
      for(j = 0; j < divisions; j++){
        //for each division, find first instance of "\n"
        lastPos = output.indexOf("\n", [j+1] * maxChar);
        if(lastPos == -1) lastPos = output.length;
        sliced = output.slice(firstPos, lastPos);
        if(sliced.length != 0){
          message.channel.send(sliced);
        }
        //console.log("!!!"+firstPos+"@@@"+lastPos);
        firstPos = lastPos;
      }
    }
  }
}

function goodCall(nestPark, nestPoke, message){
  authentication.authenticate().then((auth)=>{//run this function to pull all data (will need to check against it)
    fetchMaster(auth).then(function (fulfilled) {
      authentication.authenticate().then((auth)=>{//send to function to update spreadsheet
        updateList(auth, nestPoke, nestPark, message);
      });
    });
    message.react("👌");
  });
  
}

function getPoke(queryPoke){
  queryPoke = queryPoke.toLowerCase();
  testPoke = keyPokes.filter(pokemon => (pokemon.pokemon === queryPoke)).pop();//use pop to get out of array
  
  //check for misspelling
  if (testPoke == undefined){
    //get array of pokemon names
    var pokes = keyPokes.map(pokemon => (pokemon.pokemon));
    //run stringSimilarity on it    //use bestMatch
    var guessPoke = stringSimilarity.findBestMatch(queryPoke, pokes).bestMatch;
    //if rating > .8 then assume it good otherwise none
    //console.log(queryPoke);//use this to test
    //console.log(guessPoke); 
    if(guessPoke.rating > 0.57){//if want more strict spell checking, increase this value
      testPoke = keyPokes.filter(pokemon => (pokemon.pokemon === guessPoke.target)).pop();
    }
  }
  return testPoke;
}
function getPark(queryPark){
  queryPark = queryPark.toLowerCase();
  testNest = keyNests.filter(nest => (nest.nest === queryPark)).pop();
  //if they used a proper name for a dup, end here
  if (testNest != undefined && testNest.isMarked){
    testNest.isDup = true;
    return testNest;
  }else if (testNest != undefined){
     testNest.isDup = false;
     return testNest;
   } 

  //check nicknames
  if(testNest == undefined){
    testNest = keyNests.filter(nest => (nest.nickname.includes(queryPark))).pop();
    if(testNest != undefined) return testNest;
  }
  //check for misspelling
  if(testNest == undefined){
    var tempNests = keyNests.map(nest => (nest.nest));
    nests = tempNests.toString().split(",");
    var guessNest = stringSimilarity.findBestMatch(queryPark, nests).bestMatch;
    
    if(guessNest.rating > 0.7){
      //console.log("Mispell proper name "+guessNest.rating);
      testNest = keyNests.filter(nest => (nest.nest === guessNest.target)).pop();
    }
      //if they used a proper name for a dup, end here
      if (testNest != undefined && testNest.isMarked){
        testNest.isDup = true;
        return testNest;
       } else if(testNest != undefined){
        return testNest;
      }
  }

  //check for mispelled nickname?
  if(testNest == undefined){
    var allNicks = keyNests.map(nest => (nest.nickname));//get array of all nicknames (will contain blanks)
    var tempNicks = allNicks.filter(nest => (nest != " "));//remove blanks
    var nicks = tempNicks.toString().split(",");//make array using multiple nicknames per place

    var guessNick = stringSimilarity.findBestMatch(queryPark, nicks).bestMatch;
    //console.log("Misspelll nickname "+guessNick.rating);
    if(guessNick.rating > 0.57){
      testNest = keyNests.filter(nest => (nest.nickname.includes(guessNick.target))).pop();
    }

    return testNest;
  }

}
function printEmbedPark(message){
  var num = keyNests.indexOf(resp);
  var link = bigList[num][getCol("google maps", false)];
  var poke = bigList[num][getCol("pokemon", false)];

  var stars = bigList[num][getCol("rating", false)];
  var dude = bigList[num][getCol("researcher", false)];
  var conf = bigList[num][getCol("confirmed", false)];
  var usure = conf == 'TRUE' ? "spawns" : "may spawn";

  googl.expand(link)
  .then(function (longUrl) {
      //message.channel.send(longUrl);
      //console.log("long url: "+longUrl);
      if(longUrl.includes("@")){
        mapInfoStr = longUrl.substring(longUrl.indexOf("@")+1, longUrl.indexOf("/", longUrl.indexOf("@")) - 1);//not all have "z" for zoom, some have m...? Not sure how to convert taht to z
        //console.log("infostr: "+ mapInfoStr);
        mapInfo = mapInfoStr.split(",");
        zoom = mapInfo[2] > 20 ? 15 : Math.floor(mapInfo[2]);//for values larger than 20, set to 15. A decent zoom level. also use floor to avoid quarter zoom levels
        mapImage = mapWrap(mapInfo[0], parseFloat(mapInfo[1]) + 0.0015, zoom); // add 0.0015 as most maps are slightly off center
        var embed = {
          //"description": "This park is nice",
          "image": {
            "url": mapImage
          }
        }
      }
      //console.log(embed);
      if(poke == "???"){
        preable = capFirst(resp.nest) + " is still undiscovered. Help find what is nesting there!"+
        "\nHere's where it is: <" + link + ">";
      }else{
        preable = "**" + poke + "** "+ usure +" at " + capFirst(resp.nest) + " at a rate of " + stars + 
        "\nIt is located at: <" + link + ">" +
        "\nThis was found by " + dude;
      }
      console.log(embed);
      message.channel.send(preable,{ embed });
  })
  .catch(function (err) {
      console.error(err.message);
  }); 
   
}
function printPark(message){
  var num = keyNests.indexOf(resp);
  var link = bigList[num][getCol("google maps", false)];
  var poke = bigList[num][getCol("pokemon", false)];
  if(poke == "???"){//check for if nest is discovered
   message.channel.send(capFirst(resp.nest) + " is still undiscovered. Help find what is nesting there! Here's where it is: <" + link + ">");
  }else{
    var stars = bigList[num][getCol("rating", false)];
    var dude = bigList[num][getCol("researcher", false)];
    var conf = bigList[num][getCol("confirmed", false)];
    var usure = conf == 'TRUE' ? "spawns" : "may spawn";
    message.channel.send("**" + poke + "** "+ usure +" at " + capFirst(resp.nest) + " at a rate of " + stars + 
    "\nIt is located at: <" + link + ">" +
    "\nThis was found by " + dude);
  }
}

function mapWrap(lat, long, zoom){
  //outputs extremely long url 
  //longImageUrl = "https://maps.googleapis.com/maps/api/staticmap?key="+config.googleMap+"&center="+lat+","+long+"&zoom="+zoom+"&format=png&maptype=roadmap&style=element:geometry%7Ccolor:0x212121&style=element:labels.icon%7Cvisibility:off&style=element:labels.text.fill%7Ccolor:0x757575&style=element:labels.text.stroke%7Ccolor:0x212121&style=feature:administrative%7Celement:geometry%7Ccolor:0x757575&style=feature:administrative.country%7Celement:labels.text.fill%7Ccolor:0x9e9e9e&style=feature:administrative.land_parcel%7Cvisibility:off&style=feature:administrative.locality%7Celement:labels.text.fill%7Ccolor:0xbdbdbd&style=feature:poi%7Celement:labels.text.fill%7Ccolor:0x757575&style=feature:poi.park%7Celement:geometry%7Ccolor:0x181818&style=feature:poi.park%7Celement:geometry.fill%7Ccolor:0x008000%7Cvisibility:on&style=feature:poi.park%7Celement:labels.text.fill%7Ccolor:0x616161&style=feature:poi.park%7Celement:labels.text.stroke%7Ccolor:0x1b1b1b&style=feature:road%7Celement:geometry.fill%7Ccolor:0x2c2c2c&style=feature:road%7Celement:labels.text.fill%7Ccolor:0x8a8a8a&style=feature:road.arterial%7Celement:geometry%7Ccolor:0x373737&style=feature:road.highway%7Celement:geometry%7Ccolor:0x3c3c3c&style=feature:road.highway.controlled_access%7Celement:geometry%7Ccolor:0x4e4e4e&style=feature:road.local%7Celement:labels.text.fill%7Ccolor:0x616161&style=feature:transit%7Celement:labels.text.fill%7Ccolor:0x757575&style=feature:water%7Celement:geometry%7Ccolor:0x000000&style=feature:water%7Celement:labels.text.fill%7Ccolor:0x3d3d3d&size=480x360";
  //put api key in config
  //console.log(lat, long);
  longImageUrl = "https://www.mapquestapi.com/staticmap/v5/map?key=2OTyBwpvuVbQfAZf7oY0BSFhKcMDPsHa&center="+lat+","+long+"&zoom="+zoom+"&size=600,400@2x"
  //console.log(longImageUrl);
  return longImageUrl;
}

function autoconfirm(memRoles){//small function to go through list of roles that count as auto-confirming roles
  for(i = 0;i < roleList.length; i++){
    finds = memRoles.find("name", roleList[i]);
    if (finds != null){
      if(memRoles.has(finds.id)){
        return true;
      }
    }
  }
  return false;
}

function updateList(auth, nestPoke, nestPark, message){
  var trainer = message.member;
  //check so see if we are crediting someone else
  if(message.content.includes("!from")){
    const re = /\d+/;
    userId = re.exec(message.content).pop();
    trainer = message.guild.members.find("id", userId);
    //console.log(trainer.id);
  }

  var values = [[]];
  var rowNum = keyNests.indexOf(nestPark);
  //console.log(rowNum);

  var potPoke = bigList[rowNum][getCol("pokemon",false)].toLowerCase();
  var reseachers = bigList[rowNum][getCol("researcher",false)];

  // some people can auto-verify, check to see if they can
  var troles = trainer.roles;
  var autoTrue = autoconfirm(troles);
  // if someone doesn't want auto-verify
  if(message.content.includes("suspected")){
    autoTrue = false;
  }
  //store name of person who verified nest
  var thxto = trainer.displayName;

  //modify values array based on what needs to be updated

  //find out where 1."pokemon" 2."location" 3."confirmed" is
  var big4 = colOrder.filter(function(word){ //get array only of 3 important columns
    return word == "pokemon" || word == "location" || word == "confirmed" || word == "researcher";
  });
  //determine first and last column number
  var firstCol = colOrder.indexOf(big4[0]);
  var lastCol = colOrder.indexOf(big4[3]);
  //modify arr "values" based on big4

  //determine what to put in researcher field
  var newGuys = "";
  if(reseachers == undefined || reseachers == ""){
    //first one to help
    newGuys = trainer.displayName;
    }else if(reseachers.indexOf(trainer.displayName) >= 0){
     //already helped
     newGuys = reseachers;
     }else{
    //new guy
    //set researcher cell to what it was + trainer.displayname
    newGuys = reseachers + ", " + trainer.displayName;
  }
  //console.log("here?");
  if(potPoke == nestPoke){//confirmation
    for(i = 0; i < lastCol - firstCol +1; i++){//create values array setting all to null except the confirmation
      if(colOrder[i] == "confirmed"){
        values[0][i]="TRUE";
      }else if(colOrder[i] == "researcher"){
        values[0][i] = newGuys;
      }else{
        values[0][i]=null;
      }
    }
    console.log(nestPoke+" confirmed");
    //message.clearReactions();
    setTimeout(function() {message.react("👍")}, 2000);
  }
  else if(potPoke == "???"){//new pokemon sighting
    for(i = 0; i < lastCol - firstCol +1; i++){//create values array setting all to null except the confirmation and pokemon
      if(colOrder[i] == "pokemon"){
        values[0][i]=capFirst(nestPoke);
      }else if(colOrder[i] == "confirmed"){
        values[0][i]=autoTrue;
      }else if(colOrder[i] == "researcher"){
        values[0][i] = newGuys;
      }else{
        values[0][i]=null;
      }
    }
    console.log(nestPark.nest+" updated");
    //message.clearReactions();
    setTimeout(function() {message.react("👍")}, 1000);
  }
  else{
    //console.log("conflict detected at " + bigList[rowNum][getCol("location", false)]);
    //message.clearReactions();
    setTimeout(function() {message.react("❌")}, 1000);
    values = [];
  }

  if(values.length > 0){//make sure we are actually putting data to sheet
    var data = [];
    data.push({
      range: "Nest List!"+getCol(big4[0],true)+""+parseInt(rowNum+3)+":"+getCol(big4[3],true)+""+parseInt(rowNum+3),
      values: values
    });
    var body = {
      data: data,
      valueInputOption: "USER_ENTERED"
    };
    
    //actual updating
    var sheets = google.sheets('v4');
    sheets.spreadsheets.values.batchUpdate({
      auth: auth,
      spreadsheetId: listID,
      resource: body
    }, function(err, result){
      if(err){
        console.log(err);
      } else{
        console.log('cell updated' + result.totalUpdatedCells);
        newAdds++;
        console.log("report added. new reports = "+newAdds);
        if(newAdds >= refreshNum){//auto-refresh nest list after so many updates
          newAdds = 0;
          authentication.authenticate().then((auth)=>{
            listBest(auth);
         });
        }
      }
    });
  }
}


function listBest(auth) {
  var sheets = google.sheets('v4');
  var endCol = getCol(colOrder[colOrder.length-1],true);
  sheets.spreadsheets.values.get({
    auth: auth,
    spreadsheetId: listID,
    range: 'Nest List!A2:'+endCol, //edit range to check here
  }, function(err, response) {
    if (err) {
      console.log('The API returned an error: ' + err);
      return;
    }
    var rawrows = response.values;
    if (rawrows.length == 0) {
      console.log('No data found.');
    } else {
      runner++;
      console.log(runner + " instances running");

      var rows = deleteRow(rawrows, 1);//split rawrows (a 2D array) remove first row, rows[1-4][0]
      var header = rawrows[0][0];

      //pull county column (copy district code to concat county####)

      //we want to organize by district. get a list of all districts
      var dupdistricts = [];
      for (var i = 0; i < rows.length; i++){
        dupdistricts = dupdistricts.concat(rows[i][getCol("district",false)]); 
      }
      //get all districts, removing duplicates
      var districts = uniq(dupdistricts);
       
      var printdis = [];
      var inCounty = [];
      var rawfolks = [];
      //for loop to go through all list - store all nests in one big string
      for (var i = 0; i < rows.length; i++){
        //for loop to go through all districts
        var sel = rows[i];
        for (var j = 0; j < districts.length; j++){ 
          if(sel[getCol("district", false)]==districts[j]){//set nest name, etc to proper string 
            ///store waht county each district is in 
            inCounty[j] = sel[getCol("county",false)];  

            //make if statement that checks another column (confirmed or not)
            var isVerStr = "";
            var isVeStB = "";
            if(sel[getCol("confirmed",false)] == "TRUE"){ 
              isVerStr = "**";
              isVeStB = "**";
            }else if(sel[getCol("confirmed",false)] == "FALSE"){
              isVerStr = " (U)"
            }
            //make if statement that checks another column (confirmed or not)
            var isFurStr = "";
            var isFuStB = "";
            var printPoke = getPoke(sel[getCol("pokemon",false)]);
            if(printPoke != undefined && printPoke.laterGen == "TRUE"){ 
              isFurStr = "__";
              isFuStB = "__";
            }
            //combine all nests into one string
            if(printdis[j] == null){
              printdis[j] = "[" + sel[getCol("location",false)] + "](" + sel[getCol("google maps",false)] + ") - " + sel[getCol("rating",false)] + " - " + isVeStB + isFurStr + sel[getCol("pokemon",false)] + isFuStB + isVerStr;
            }else{
              printdis[j] = printdis[j] + "\n[" + sel[getCol("location",false)] + "](" + sel[getCol("google maps",false)] + ") - " + sel[getCol("rating",false)] + " - " + isVeStB + isFurStr + sel[getCol("pokemon",false)] + isFuStB + isVerStr; 
            }
            //store researchers by district
            if(rawfolks[j] == null){
              rawfolks[j] = sel[getCol("researcher", false)];
            }else{
              rawfolks[j] = rawfolks[j] + "," + sel[getCol("researcher", false)];
            }
          }  
        }
      }
      //console.log(keyCount);
      //console.log("keycount^^^");
      /// for each channel run different displaylist
      for(k = 0; k < listChan.length; k++){
        //get county from keycount using listChat
        var countyObj = keyCount.filter(count => (count.channel.includes(listChan[k])));
        //console.log(countyObj);
        //console.log("county obj^^^");
        var countyName = countyObj.map(cnt => cnt.county);
        //console.log(countyName);
        //console.log("county name^^^");
        var tempDist = [];
        var tempPrint = [];
        var tempFolks = [];
        for(m = 0; m < districts.length; m++){
          //console.log(districts[m]+" is in "+inCounty[m]+ "county is");
          if(countyName.includes(inCounty[m])){///if the array of objects taht is county contains county info that == inCounty
            tempDist.push(districts[m]);
            tempPrint.push(printdis[m]);
            tempFolks.push(rawfolks[m]);
          }
        }
        //run delete here with listChan
        chann = bot.channels.find("id", listChan[k]);
        clearList(chann);
        //console.log(tempFolks);
        //console.log(chann.id);
        printThanks(tempFolks, chann);
        displayList(tempDist, tempPrint, header, listChan[k]); 
      }
      // if conty not contained in distincounty then district and printdis copy pop
      // run displaylist for each county
    }
  });
}



bot.login(config.token);