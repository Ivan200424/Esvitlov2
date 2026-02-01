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

const REGION_CODES = Object.keys(REGIONS);

module.exports = {
  REGIONS,
  REGION_CODES,
  GROUPS,
  SUBGROUPS,
  QUEUES,
};
