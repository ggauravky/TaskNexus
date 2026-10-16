const teamService = require("./teamService");
const projectService = require("./projectService");
const discoveryService = require("./discoveryService");
const hackathonService = require("./hackathonService");
const opportunityService = require("./opportunityService");
const taskService = require("./taskService");
const {
  SEARCH_GROUPS,
  SEARCH_RESULT_LIMIT,
  serializeSearchResult,
} = require("../serializers");

const search = async ({ query, viewer }) => {
  const searches = [
    teamService.searchTeams(query, viewer),
    projectService.searchProjects(query, viewer),
    discoveryService.searchPeople(query, viewer),
    hackathonService.searchHackathons(query, viewer),
    opportunityService.searchOpportunities(query, viewer),
    opportunityService.searchOrganizations(query, viewer),
    taskService.searchMarketplaceTasks(query, viewer),
  ];
  const rowsByGroup = await Promise.all(searches);
  const groups = {};
  SEARCH_GROUPS.forEach((group, index) => {
    groups[group] = rowsByGroup[index]
      .map(serializeSearchResult)
      .filter(Boolean)
      .slice(0, SEARCH_RESULT_LIMIT);
  });
  return { query, groups };
};

module.exports = { search };
