// hide the disclaimer on startup
const disclaimer = document.getElementById("disclaimer");
disclaimer.style.display = "none";

// Define arrays of search engines for each filter
const webSearchEngines = [
  "www.google.com/search?q=",
  "searx.tiekoetter.com/search?q=",  
  "search.yahoo.com/search?p=",
  "yandex.com/search/?text=",
  "www.seekr.com/search?query=",
  "www.mojeek.com/search?q=",
  "duckduckgo.com/?q=",
  "www.bing.com/search?q=",
  // searxng instances - searx.space
  "northboot.xyz/search?q=",
  "searx.fmac.xyz/search?q=",
  "search.rhscz.eu/search?q=",
];

const scholarSearchEngines = [
  "scholar.google.com/scholar?hl=en&as_sdt=0%2C2&q=", 
  "www.jstor.org/action/doBasicSearch?Query=",
  "www.semanticscholar.org/search?sort=relevance&q=",
  "www.refseek.com/search?q=",
  "core.ac.uk/search?q=",
  "eric.ed.gov/?q=",
  "www.base-search.net/Search/Results?&lookfor=",
  "www.mendeley.com/search/?query=",
  "www.jurn.link/#gsc.tab=0&gsc.q=",
  "researchworks.oclc.org/archivegrid/?q=",
  "paperity.org/search/?q=",
  "fatcat.wiki/release/search?q=",
  "www.econbiz.de/Search/Results?type=AllFields&lookfor=",
  "www.worldcat.org/search?q=",
  "www.emerald.com/insight/search?q=",
  "www.loc.gov/search/?q=",
  "www.ncbi.nlm.nih.gov/pmc/?term=",
  "www.google.com/search?tbm=bks&q=",
  "network.bepress.com/explore/?q=",
  "www.researchgate.net/search/publication?q=",
  "www.scirp.org/journal/articles.aspx?searchcode=",
  "www.scopus.com/results/results.uri?sort=plf-f&src=s&st1=",
  "ieeexplore.ieee.org/search/searchresult.jsp?newsearch=true&queryText=",
  "www.sciencedirect.com/search?qs=",
  "www.sciencedirect.com/search?pub=",
  "www.sciencedirect.com/search?authors=",
  "core.ac.uk/search?q=",
  "www.semanticscholar.org/search?sort=relevance&q=",
  "www.refseek.com/search?q=",
  "dl.acm.org/action/doSearch?fillQuickSearch=false&target=advanced&expand=dl&field1=AllField&text1=",
  "dblp.uni-trier.de/search?q=",
  "www.uptodate.com/contents/search?search=",
];

const databaseSearchEngines = [
  "archive.org/search?query=", 
  "datasetsearch.research.google.com/search?query=", 
  "catalog.data.gov/dataset?q=",
  "www.elephind.com/?a=q&hs=1&r=1&results=1&txq="
];

// Get the filter checkboxes and search button
const webFilter = document.getElementById("web-filter");
const scholarFilter = document.getElementById("scholar-filter");
const databaseFilter = document.getElementById("database-filter");
const searchBtn = document.getElementById('search-btn');

let web_urls = [];
let scholar_urls = [];
let database_urls = [];
let browserName;

function disco(){
  // for every url list, if the corresponding filter has been checked, open up new tabs for each url
  if (webFilter.checked) {
    for (const element of web_urls) {
      window.open(element, "_blank");
    }
  }
  if (scholarFilter.checked) {
    for (const element of scholar_urls) {
      window.open(element, "_blank");
    }
  }
  if (databaseFilter.checked) {
    for (const element of database_urls) {
      window.open(element, "_blank");
    }
  }
}

// depending on the browser, conduct the searches
function discoveryConduct(){
  // Make individual searches

  // clear urls out
  web_urls = [];
  scholar_urls = [];
  database_urls = [];

  let searchQuery = document.getElementById("search-input").value;
  // replace spaces with plus signs
  searchQuery = encodeURIComponent(searchQuery);

  // if search query is blank, show disclaimer and exit
  if (searchQuery == "") {
    disclaimer.style.display = "block";
    return;
  }

  // make urls for each type of search engine
  for (const element of webSearchEngines) {
    let url = "https://" + element + searchQuery;
    web_urls.push(url);
  }

  for (const element of scholarSearchEngines) {
    let url = "https://" + element + searchQuery;
    scholar_urls.push(url);
  }

  for (const element of databaseSearchEngines) {
    let url = "https://" + element + searchQuery;
    database_urls.push(url);
  }

  // try to run the disco function
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
