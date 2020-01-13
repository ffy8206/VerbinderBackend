const express = require('express');
const {
    Project,
    Resource,
    Industry,
    Deliverable,
    Technology,
    sequelizeInstance
} = require('./entity/datadefinition');
const {
    Op
} = require('sequelize');
const app = express();

sequelizeInstance.sync({
    force: true
}).then(()=>console.log("===============!!!!!"));
app.listen(4500, () => console.log('server started on port 4500!'))

app.get('/api/resources', (req, res) => {
    const obj = req.query.q || '' ? {
        where: {
            name: {
                [Op.iLike]: '%' + req.query.q.trim() + '%'
            }
        }
    } : {};
    Resource.findAll(obj).then(resources => {
        res.set({
            'Access-Control-Allow-Origin': 'http://localhost:4200'
        }).send({
            result: resources
        });
    });
});

app.get('/api/technologies', (req, res) => {
    const obj = req.query.q || '' ? {
        where: {
            name: {
                [Op.iLike]: '%' + req.query.q.trim() + '%'
            }
        }
    } : {};
    Resource.findAll(obj).then(technologies => {
        res.set({
            'Access-Control-Allow-Origin': 'http://localhost:4200'
        }).send({
            result: technologies
        });
    });
});

/**
 * {name:'',requirement:'',industry:'',deliverable:'',resources:[],technologies:[]}
 */
app.get('/api/getkgstruct', async (req, res) => {
        query = req.query.q || '';
        queryObj = JSON.parse(query);

        [industry, created] = await Industry.findOrCreate({
            where: {
                name: queryObj.industry,
                owner: 1
            }
        });

        [deliverable, created] = await Deliverable.findOrCreate({
                where: {
                    name: queryObj.deliverable,
                    owner: 1
                }
        });
        project = await Project.create({
                    name: queryObj.name,
                    requirement: queryObj.requirement,
                    owner: 1,
                    contact: 'BU',
                    industryId: industry.id,
                    deliverableId: deliverable.id
        });

        createdResources = [];
        for(let r of queryObj.resources){
            [resource, created] = await Resource.findOrCreate({
                where: {
                    name: r,
                    owner: 1
                }
            });
            createdResources.push(resource);
        }
        project.setResources(createdResources);

        createdTechs = [];
        for(let t of queryObj.technologies){
            [technology, created] = await Technology.findOrCreate({
                where: {
                    name: t,
                    owner: 1
                }
            });
            createdTechs.push(technology);
        }
        project.setTechnologies(createdTechs);

        matchedProjects = await findMatch(project, industry, deliverable, createdResources, createdTechs);
        console.log("matched Projects:"+matchedProjects);
        datas = await buildDataByProjects(matchedProjects);
        res.set({
            'Access-Control-Allow-Origin': 'http://localhost:4200'
        }).send({
            result: datas
        });
    }

);


async function findMatch(project, industry, deliverable, resources, technologies){
    projects = [];
    projects.push(project);
    // find by similar requirements
    foundProjects = await Project.findAll({
        where: {
            [Op.or]:{
                requirement: {
                    [Op.iLike]:'%'+project.requirement+'%'
                },
                industryId:industry.id,
                deliverableId:deliverable.id
            },
            owner: 0
        }
    });

    foundProjects.forEach(fp=>projects.push(fp));
    // find by same resources
    for(let r of resources){
        foundResources = await Resource.findAll({
            name: r.name,
            owner: 0
        });
        for(let fr of foundResources){
            ps = await fr.getProjects();
            ps.forEach(pp=>projects.push(pp));
        }
    }
    // find by same technologies
    for(let t of technologies){
        foundTechs = await Technology.findAll({
            name: t.name,
        });
        for(let ft of foundTechs){
            ps = await ft.getProjects();
            ps.forEach(pp=>projects.push(pp));
        }
    }
    return projects;
}

async function buildDataByProjects(projects){
    datas = [];
    tmps = {};
    for(let p of projects){
        tmp = {source: project.name, target: project.requirement, rela: 'Requires'};
        if(!tmps[project.name+project.requirement+'Requires']){
            tmps[project.name+project.requirement+'Requires'] = 1;
            datas.push(tmp);
        }
        
        industry = await Industry.findByPk(p.industryId);
        tmp = {source: p.name, target: industry.name, rela:'Belongs'};
        if(!tmps[p.name+industry.name+'Belongs']){
            tmps[p.name+industry.name+'Belongs'] = 1;
            datas.push(tmp);
        }

        deliverable = await Deliverable.findByPk(p.deliverableId);
        tmp = {source: p.name, target: deliverable.name, rela:'Expects'};
        if(!tmps[p.name+deliverable.name+'Expects']){
            tmps[p.name+deliverable.name+'Expects'] = 1;
            datas.push(tmp);
        }

        resources = await p.getResources();
        for(let r of resources){
            tmp = {source: p.name, target: r.name, rela: 'Has'};
            if(!tmps[p.name+r.name+'Has']){
                tmps[p.name+r.name+'Has'] = 1;
                datas.push(tmp);
            }
        }
        technologies = await p.getTechnologies();
        for(let t of technologies){
            tmp = {source: p.name, target: t.name, rela: 'Uses'};
            if(!tmps[p.name+t.name+'Uses']){
                tmps[p.name+t.name+'Uses'] = 1;
                datas.push(tmp);
            }
        }
    }
    return datas;
}