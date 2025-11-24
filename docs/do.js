// hide the disclaimer on startup
const disclaimer = document.getElementById("disclaimer");
disclaimer.style.display = "none";

// Define arrays of search engines for each filter
const webSearchEngines = [
  "www.google.com/search?q=",
  "searx.oloke.xyz/search?q=",  
  "search.yahoo.com/search?p=",
  "yandex.com/search/?text=",
  "www.mojeek.com/search?q=",
  "duckduckgo.com/?q=",
  "www.bing.com/search?q=",
];

const scholarSearchEngines = [
  "scholar.google.com/scholar?hl=en&as_sdt=0%2C2&q=", 
  "www.jstor.org/action/doBasicSearch?Query=",
  "www.semanticscholar.org/search?sort=relevance&q=",
  "www.refseek.com/search?q=",
  "core.ac.uk/search?q=",
  "eric.ed.gov/?q=",
  "www.base-search.net/Search/Results?oaboost=1&newsearch=1&refid=dcbasen&lookfor=",
  "www.mendeley.com/search/?query=",
  "www.jurn.link/#gsc.tab=0&gsc.q=",
  "researchworks.oclc.org/archivegrid/?q=",
  "paperity.org/search/?q=",
  "fatcat.wiki/release/search?q=",
  "www.econbiz.de/Search/Results?type=AllFields&lookfor=",
  "www.worldcat.org/search?q=",
];

const databaseSearchEngines = [
  "archive.org/search?query=", 
  "datasetsearch.research.google.com/search?query=", 
  "catalog.data.gov/dataset?q=",
  "www.elephind.com/?a=q&hs=1&r=1&results=1&txq="
];

// PDF/eBook search engines with their specific query formats
const pdfSearchEngines = [
  { base: "annas-archive.org/search?q=", usePlus: true, type: "native" },
  { base: "oceanofpdf.com/?s=", usePlus: true, type: "native" },
  { base: "pdfcoffee.com", usePlus: true, type: "google" }, // Google dork works better
  { base: "welib.org/search?page=1&q=", usePlus: true, type: "native" },
  { base: "www.gutenberg.org/ebooks/search/?query=", usePlus: true, type: "native" },
  { base: "libgen.ac/s/", usePlus: false, type: "native" }, // uses %20 for spaces
  { base: "pdfdrive.com.co/?s=", usePlus: true, type: "native" },
  { base: "archive.org", usePlus: true, type: "google" }, // Google dork works better
  { base: "z-library.sk/s/", usePlus: false, type: "native" }, // uses %20 for spaces
  { base: "www.reddit.com/r/FreeEBOOKS/search/?q=", usePlus: true, type: "native" },
  { base: "it-ebooks-search.info/search?q=", usePlus: true, type: "native" }
];

// Get the filter checkboxes and search button
const webFilter = document.getElementById("web-filter");
const scholarFilter = document.getElementById("scholar-filter");
const databaseFilter = document.getElementById("database-filter");
const pdfFilter = document.getElementById("pdf-filter");
const searchBtn = document.getElementById('search-btn');

let web_urls = [];
let scholar_urls = [];
let database_urls = [];
let pdf_urls = [];
let browserName;

function disco(){
  // for every url list, if the corresponding filter has been checked, open up new tabs for each url
  if (webFilter.checked) {
    for (const element of web_urls) {
      window.open("https://"+element, "_blank");
    }
  }
  if (scholarFilter.checked) {
    for (const element of scholar_urls) {
      window.open("https://"+element, "_blank");
    }
  }
  if (databaseFilter.checked) {
    for (const element of database_urls) {
      window.open("https://"+element, "_blank");
    }
  }
  if (pdfFilter.checked) {
    for (const element of pdf_urls) {
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
  database_urls = [];
  pdf_urls = [];

  let searchQuery = document.getElementById("search-input").value;

  // if search query is blank, show disclaimer and exit
  if (searchQuery == "") {
    disclaimer.style.display = "block";
    return;
  }

  // Replace spaces with plus signs for standard queries
  let searchQueryPlus = searchQuery.replace(/ /g, "+");
  
  // Replace spaces with %20 for URL encoding
  let searchQueryEncoded = searchQuery.replace(/ /g, "%20");

  // make urls for each type of search engine
  for (const element of webSearchEngines) {
    let url = element + searchQueryPlus;
    web_urls.push(url);
  }

  for (const element of scholarSearchEngines) {
    let url = element + searchQueryPlus;
    scholar_urls.push(url);
  }

  for (const element of databaseSearchEngines) {
    let url = element + searchQueryPlus;
    database_urls.push(url);
  }

  // PDF/eBook search using native site search or Google dorking
  if (pdfFilter.checked) {
    for (const engine of pdfSearchEngines) {
      let url;
      if (engine.type === "google") {
        // Use Google dork for better results on these sites
        url = `www.google.com/search?q=site:${engine.base}+${searchQueryPlus}+filetype:pdf`;
      } else {
        // Use native site search
        let query = engine.usePlus ? searchQueryPlus : searchQueryEncoded;
        url = engine.base + query;
      }
      pdf_urls.push(url);
    }
    
    // Add general Google PDF search
    let generalPdfSearch = `www.google.com/search?q=${searchQueryPlus}+filetype:pdf`;
    pdf_urls.push(generalPdfSearch);
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