const regionNames = require('./aws-region-names.js');
const serviceNames = {};
const regionSummary = {};
const locationsMap = {
  edgeLocations: [],
  regionalEdgeCaches: []
};

const transpose = (array = []) => {
  return (array && array[0]) ? array[0].map((_, c) => array.map(r => r[c])) : [];
};
const flatten = (array) => {
  return array.reduce(
    (acc, cur) => acc.concat(cur),
    []
  ).filter((item = '') => {
    return item.length > 0;
  });
};
const cheerio = require('cheerio');

function parseAwsTable(html) {
  const $ = cheerio.load(html);
  let services = {};

  $('table').each(function(awsTableIndex) {
    let regions = [];

    const isServiceTable = $(this).text().toLowerCase().includes('services offered');
    // TODO: do a better check if table is AWS Edge Network Locations table.
    if (isServiceTable) {
      $(this).find('tr').each(function(rowIndex, row) {
        // first <tr> always has the Region Name
        const coloumns = $(row).find('th').length > 0 ? $(row).find('th') : $(row).find('td');

        if (rowIndex === 0) {
          coloumns.each(function (coloumnIndex, coloumn) {
            let region = null;
            const parsedRegionName = $(coloumn).text().toLowerCase().trim()
              .replace(/ /ig, '_')
              .replace(/[()* ]/ig, '').trim();

            if (parsedRegionName.length > 0) {
              region = regionNames[parsedRegionName] || {};
            }

            if (!region.code && !parsedRegionName.includes('services_offered:')) {
              console.log('\x1b[33m%s\x1b[0m', 'region name: ' + parsedRegionName + ' not found in "./aws-region-names.js"');
            }

            if (region.code) {
              regions.push(region.code);
            }
          });
        } else {
          const parsedServiceName = coloumns.eq(0).find('a').eq(0).text().trim();
          let serviceName = parsedServiceName.toLowerCase().trim().replace(' - ', '_').replace(/[ .]/ig, '_').replace(/[()/]/ig, '').replace('__', '_').replace('amazon_', '').replace('aws_', '');

          if (parsedServiceName) {
            coloumns.each(function (coloumnIndex,coloumn) {
              if (coloumnIndex === 0) {
                services[serviceName] = services[serviceName] || {};
              } else {
                let regionCode = regions[coloumnIndex -1];
                let isServiceSupportedInRegion = $(coloumn).text() === '✓';

                if (regionCode) {
                  services[serviceName][regionCode] = isServiceSupportedInRegion;

                  regionSummary[regionCode] = regionSummary[regionCode] || {
                    regionCode: regionCode,
                    regionName: Object.values(regionNames).filter(region => region.code === regionCode)[0].name,
                    value: 0
                  };

                  if (isServiceSupportedInRegion) {
                    regionSummary[regionCode].value++;
                  }
                }
              }

              serviceNames[serviceName] = parsedServiceName;
            });
          }
        }
      });
    } else {
      // Locations Table parsing
      let edgeType = 'edgeLocations';
      let rowIndex = 0;

      $(this).find('tbody tr').each(function() {
        const column = $(this);
        const columnText = $(this).text().toLowerCase().trim();

        if (columnText === 'regional edge caches') {
          edgeType = 'regionalEdgeCaches';
          rowIndex = 0;
        }

        const cells = column.find('td');

        locationsMap[edgeType].push([]);
        cells.each(function (cellIndex,cell) {
          const cellText = $(cell).text().trim();
          locationsMap[edgeType][rowIndex].push(cellText);
        });

        rowIndex++;
      });
    }
  });

  locationsMap.edgeLocations.splice(0, 3); // remove the first 3 rows ( Edge Locations, North America..., United States... )
  locationsMap.regionalEdgeCaches.shift(); // remove first item

  locationsMap.edgeLocations = transpose(locationsMap.edgeLocations);
  locationsMap.regionalEdgeCaches = transpose(locationsMap.regionalEdgeCaches);

  const addCountryNameToUsLocations = (array = []) => {
    return array.map((location = '') => {
      if (location && location.match(/ \(.+?\)/ig)) {
        return location.replace(/ \(.+?\)/ig, ', United States$&')
      } else {
        return location.length > 0 ? `${location}, United States` : ''
      }
    })
  };

  locationsMap.edgeLocations[0] = addCountryNameToUsLocations(locationsMap.edgeLocations[0]);
  locationsMap.regionalEdgeCaches[0] = addCountryNameToUsLocations(locationsMap.regionalEdgeCaches[0]);

  locationsMap.edgeLocations = flatten(locationsMap.edgeLocations);
  locationsMap.regionalEdgeCaches = flatten(locationsMap.regionalEdgeCaches);

  const edgeLocationsCount = locationsMap.edgeLocations.length;
  let edgeLocationsTotalCount = 0;

  locationsMap.edgeLocations.forEach((edgeLocation) => {
    edgeLocationsTotalCount += parseInt(edgeLocation.replace(/\D/g, ''), 10) || 1;
  });


  const regionsCount = Object.keys(regionSummary).length;
  const servicesCount = Object.keys(services).length;
  const regionalEdgeCachesCount = Object.keys(locationsMap.regionalEdgeCaches).length;
  console.log('\x1b[32m%s\x1b[0m', regionsCount.toString().padStart(3) + ' AWS Regions found.');
  console.log('\x1b[32m%s\x1b[0m', servicesCount.toString().padStart(3) + ' AWS Services found.');
  console.log('\x1b[32m%s\x1b[0m', edgeLocationsTotalCount.toString().padStart(3) + ' AWS Edge Locations found in ' + edgeLocationsCount + ' cities.');
  console.log('\x1b[32m%s\x1b[0m', regionalEdgeCachesCount.toString().padStart(3) + ' AWS Regional Edge Cache Locations found.');

  return {
    regionSummary: regionSummary,
    services: services,
    serviceNames: serviceNames,
    edgeLocations: locationsMap.edgeLocations,
    regionalEdgeCaches: locationsMap.regionalEdgeCaches,
    regionsCount: regionsCount,
    servicesCount: servicesCount,
    edgeLocationsTotalCount: edgeLocationsTotalCount,
    edgeLocationsCount: edgeLocationsCount,
    regionalEdgeCachesCount: regionalEdgeCachesCount
  };
}

module.exports = parseAwsTable;
