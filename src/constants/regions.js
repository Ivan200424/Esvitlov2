// Список регіонів та черг для моніторингу відключень електроенергії

const REGIONS = {
  kyiv: {
    name: 'Київ',
    code: 'kyiv',
  },
  'kyiv-region': {
    name: 'Київська область',
    code: 'kyiv-region',
  },
  dnipro: {
    name: 'Дніпро',
    code: 'dnipro',
  },
  odesa: {
    name: 'Одеса',
    code: 'odesa',
  },
};

const GROUPS = [1, 2, 3, 4, 5, 6];
const SUBGROUPS = [1, 2];

// Генерація всіх можливих черг (GPV1.1, GPV1.2, GPV2.1, GPV2.2, GPV3.1, GPV3.2)
const QUEUES = [];
GROUPS.forEach(group => {
  SUBGROUPS.forEach(subgroup => {
    QUEUES.push(`${group}.${subgroup}`);
  });
});

const REGION_CODES = Object.keys(REGIONS);

module.exports = {
  REGIONS,
  REGION_CODES,
  GROUPS,
  SUBGROUPS,
  QUEUES,
};
