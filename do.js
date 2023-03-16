// hide the disclaimer on startup
const disclaimer = document.getElementById("disclaimer");
disclaimer.style.display = "none";

// Define arrays of search engines for each filter
const webSearchEngines = [
  "www.google.com/search?q=", 
  "www.bing.com/search?q=", 
  "search.yahoo.com/search?p="
];

const scholarSearchEngines = [
  "Google Scholar", 
  "Microsoft Academic", 
  "Semantic Scholar"
];

const newsSearchEngines = [
  "CNN", 
  "BBC", 
  "New York Times"
];

const databaseSearchEngines = [
  "PubMed", 
  "JSTOR", 
  "IEEE Xplore"
];

// Get the filter checkboxes and search button
const webFilter = document.getElementById("web-filter");
const scholarFilter = document.getElementById("scholar-filter");
const newsFilter = document.getElementById("news-filter");
const databaseFilter = document.getElementById("database-filter");
const searchBtn = document.getElementById('search-btn');

let web_urls = [];
let scholar_urls = [];
let news_urls = [];
let database_urls = [];
let browserName;

function disco(){
  // for every url list, if the corresponding filter has been checked, open up new tabs for each url
  if (webFilter.checked) {
    for (const element of web_urls) {
      window.open("https://"+element, "_blank");
    }
  }
}

// depending on the browser, conduct the searches
function discoveryConduct(){
  // Make individual searches

  // clear urls out
  web_urls = [];
  scholar_urls = [];
  news_urls = [];
  database_urls = [];

  const searchQuery = document.getElementById("search-input").value;
  //console.log(searchQuery);

  // if search query is blank, show disclaimer and exit
  if (searchQuery == "") {
    disclaimer.style.display = "block";
    return;
  }

  // make urls for each type of search engine
  for (const element of webSearchEngines) {
    let url = element + searchQuery;
    web_urls.push(url);
  }

  for (const element of scholarSearchEngines) {
    let url = element + searchQuery;
    scholar_urls.push(url);
  }

  for (const element of newsSearchEngines) {
    let url = element + searchQuery;
    news_urls.push(url);
  }

  for (const element of databaseSearchEngines) {
    let url = element + searchQuery;
    database_urls.push(url);
  }

  // try to run the chromeDisco function
  // if it fails, then show the disclaimer
  try {
    disco();
  } catch (error) {
    console.log(error);
  }
}

// Add click event listener to search button
searchBtn.addEventListener('click', function() {
  discoveryConduct();
});