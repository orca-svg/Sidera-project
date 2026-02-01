const mongoose = require('mongoose');
require('dotenv').config();

const Project = require('./models/Project');
const Node = require('./models/Node');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sidera')
  .then(async () => {
    console.log('Connected to MongoDB');

    try {
      const projects = await Project.find({});
      console.log(`\n=== Projects (${projects.length}) ===`);
      projects.forEach(p => console.log(`ID: ${p._id}, Name: ${p.name}, Updated: ${p.updatedAt}`));

      const nodes = await Node.find({});
      console.log(`\n=== Nodes (${nodes.length}) ===`);
      nodes.forEach(n => console.log(`ID: ${n._id}, ProjectId: ${n.projectId}, Content: "${n.question.substring(0, 20)}..."`));

      // Check correlation
      if (projects.length > 0) {
        const firstPid = projects[0]._id;
        const linkedNodes = await Node.find({ projectId: firstPid });
        console.log(`\n=== Nodes for First Project (${firstPid}) ===`);
        console.log(`Count: ${linkedNodes.length}`);
      }

    } catch (err) {
      console.error(err);
    } finally {
      mongoose.disconnect();
    }
  })
  .catch(err => console.error(err));
