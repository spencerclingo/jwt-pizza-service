const Role = {
  Diner: 'diner',
  Franchisee: 'franchisee',
  Admin: 'admin',
};

// TODO: This feels like it could lead to issues where you can access things you shouldn't
// TODO: Maybe a class instead of a role object with all 3 would be better

module.exports = { Role };
