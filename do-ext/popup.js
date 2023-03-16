// Define arrays of search engines for each filter
const webSearchEngines = ["Google", "Bing", "Yahoo"];
const scholarSearchEngines = ["Google Scholar", "Microsoft Academic", "Semantic Scholar"];
const newsSearchEngines = ["CNN", "BBC", "New York Times"];
const databaseSearchEngines = ["PubMed", "JSTOR", "IEEE Xplore"];

console.log(document.getElementById("search"));

// Get the filter checkboxes and search button
const webFilter = document.getElementById("web-filter");
const scholarFilter = document.getElementById("scholar-filter");
const newsFilter = document.getElementById("news-filter");
const databaseFilter = document.getElementById("database-filter");
const searchBtn = document.getElementById('search-button');

// Define function to get the selected search engines
function getSearchEngines() {
  let searchEngines = [];

  if (webFilter.checked) {
    searchEngines = searchEngines.concat(webSearchEngines);
  }

  if (scholarFilter.checked) {
    searchEngines = searchEngines.concat(scholarSearchEngines);
  }

  if (newsFilter.checked) {
    searchEngines = searchEngines.concat(newsSearchEngines);
  }

  if (databaseFilter.checked) {
    searchEngines = searchEngines.concat(databaseSearchEngines);
  }

  return searchEngines;
}

// Define function to handle search button click
function handleSearchButtonClick() {
  const query = document.getElementById("search-input").value;
  const searchEngines = getSearchEngines();

  console.log("Searching for \"" + query + "\" on the following search engines:");
  console.log(searchEngines);
}

// Add click event listener to search button
searchBtn.addEventListener('click', function() {
  handleSearchButtonClick();
});