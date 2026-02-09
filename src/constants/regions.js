// Список регіонів та черг для моніторингу відключень електроенергії

const REGIONS = {
  kyiv: {
    name: 'Київ',
    code: 'kyiv',
  },
  'kyiv-region': {
    name: 'Київщина',
    code: 'kyiv-region',
  },
  dnipro: {
    name: 'Дніпропетровщина',
    code: 'dnipro',
  },
  odesa: {
    name: 'Одещина',
    code: 'odesa',
  },
};

const GROUPS = [1, 2, 3, 4, 5, 6];
const SUBGROUPS = [1, 2];

// Генерація всіх можливих черг (1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 4.1, 4.2, 5.1, 5.2, 6.1, 6.2)
const QUEUES = [];
GROUPS.forEach(group => {
  SUBGROUPS.forEach(subgroup => {
    QUEUES.push(`${group}.${subgroup}`);
  });
});

// Kyiv has 66 queues: 1.1-6.2 (12 queues) + 7.1-60.1 (54 queues)
const KYIV_QUEUES = [];
// First, add standard queues 1.1-6.2
GROUPS.forEach(group => {
  SUBGROUPS.forEach(subgroup => {
    KYIV_QUEUES.push(`${group}.${subgroup}`);
  });
});
// Then add additional queues 7.1-60.1
for (let i = 7; i <= 60; i++) {
  KYIV_QUEUES.push(`${i}.1`);
}

// Map of queues by region
const REGION_QUEUES = {
  'kyiv': KYIV_QUEUES,
  'kyiv-region': QUEUES,
  'dnipro': QUEUES,
  'odesa': QUEUES,
};

// Helper function to get queues for a specific region
function getQueuesForRegion(regionCode) {
  return REGION_QUEUES[regionCode] || QUEUES;
}

const REGION_CODES = Object.keys(REGIONS);

module.exports = {
  REGIONS,
  REGION_CODES,
  GROUPS,
  SUBGROUPS,
  QUEUES,
  KYIV_QUEUES,
  REGION_QUEUES,
  getQueuesForRegion,
};
