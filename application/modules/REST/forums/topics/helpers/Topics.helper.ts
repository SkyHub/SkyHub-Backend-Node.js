/**
 * Created by Alexandru Ionut Budisteanu - SkyHub on 5/26/2017.
 * (C) BIT TECHNOLOGIES
 */

var topicModel = require ('./../models/Topic.model.ts');
var commonFunctions = require ('../../../common/helpers/common-functions.helper.ts');
var URLHashHelper = require ('../../../common/URLs/helpers/URLHash.helper.ts');
var MaterializedParentsHelper = require ('../../../../DB/common/materialized-parents/MaterializedParents.helper.ts');
var SearchesHelper = require ('../../../searches/helpers/Searches.helper.ts');
var striptags = require('striptags');
var VotingsHelper = require ('../../../Voting/helpers/Votings.helper.ts');
var TopicsSorter = require('./../models/TopicsSorter.ts');

module.exports = {

    createDummyForum (iIndex){

        iIndex = iIndex || 0;

        return this.addTopic("topic_"+iIndex,"userDummy_"+iIndex, "123456","Gigel",
            "Nume"+iIndex,"RO","Bucharest", "RO", "http://www.gravatar.com/avatar/ee4d1b570eff6ce63"+iIndex+"?default=wavatar&forcedefault=1",
            "http://www.hdfbcover.com/randomcovers/covers/never-stop-dreaming-quote-fb-cover.jpg");
    },

    /*
     FINDING & LOADING FORUM from ID, URL
     */
    async findTopic(sRequest){

        console.log("Finding topic :::  " + sRequest);

        var topicFound = await this.findTopicById(sRequest);

        if (topicFound !== null) return topicFound;
        else return await this.findTopicByURL(sRequest);
    },

    async findTopicById (sId){

        return new Promise( (resolve)=> {

            if ((typeof sId === 'undefined') || (sId == []) || (sId === null))
                resolve(null);
            else
                var TopicModel  = redis.nohm.factory('TopicModel', sId, function (err, forum) {
                    if (err) resolve (null);
                    else resolve (TopicModel);
                });

        });
    },

    findTopicByURL (sURL){

        sURL = sURL || "";
        return new Promise( (resolve)=> {
            if ((typeof sURL === 'undefined') || (sURL == []) || (sURL === null))
                resolve(null);
            else
                return null;

            var TopicModel = redis.nohm.factory('ForumModel');
            TopicModel.findAndLoad(  {URL: sURL }, function (err, topics) {
                if (topics.length) resolve(topics[0]);
                else resolve (null);
            });

        });
    },


    /*
     CREATING A NEW Topic
     */
    async addTopic (userAuthenticated, parent,  sTitle, sDescription, arrAttachments, sCoverPic, arrKeywords, sCountry, sCity, sLanguage, dbLatitude, dbLongitude, dtCreation, arrAdditionalInfo){

        if ((typeof dtCreation === 'undefined') || (dtCreation === null)) dtCreation = '';
        if ((typeof arrAdditionalInfo === 'undefined')) arrAdditionalInfo = {};

        sCountry = sCountry || ''; sCity = sCity || '';
        dbLatitude = dbLatitude || -666; dbLongitude = dbLongitude || -666;

        sLanguage = sLanguage || sCountry;
        parent = parent || '';

        var topic = redis.nohm.factory('TopicModel');
        var errorValidation = {};

        //get object from parent
        //console.log("addTopic ===============", userAuthenticated);

        let parentObject = await MaterializedParentsHelper.findObject(parent);

        if ((arrAttachments === [])&&(parentObject !== null)){
            arrAttachments = [{
                type: 'file',
                typeFile: 'image/jpeg',
                url: parentObject.p('iconPic'),
                img: parentObject.p('iconPic'),
                title: parentObject.p('Name')||parentObject.p('Title'),
            }];
        }

        if ((sCoverPic === '')&&(parentObject !== null)){
            sCoverPic = parentObject.p('coverPic');
        }

        sDescription = striptags(sDescription, ['a','b','i','u','strong', 'h1','h2','h3','h4','h5','div','font','ul','li','img', 'br', 'span','p','div','em']);
        let shortDescription = striptags(sDescription, [] );
        if (shortDescription.length > 512) shortDescription = shortDescription.substr(0, 512) + ' ...';

        topic.p(
            {
                title: sTitle,
                URL: await(URLHashHelper.getFinalNewURL( (parentObject !== null ? parentObject.p('URL') : 'home') , sTitle, null)), //Getting a NEW URL with this template: skyhub.me/forum-name/topic-name
                attachments: arrAttachments,
                description: sDescription,
                shortDescription: shortDescription,
                coverPic: sCoverPic,
                authorId: (userAuthenticated !== null ? userAuthenticated.id : ''),
                keywords: commonFunctions.convertKeywordsArrayToString(arrKeywords),
                country: sCountry.toLowerCase(),
                city: sCity.toLowerCase(),
                language: sLanguage.toLowerCase(),
                dtCreation:  dtCreation !== '' ? Date.parse(dtCreation) : new Date().getTime(),
                dtLastActivity: null,
                addInfo: arrAdditionalInfo, //Additional information
                parentId: await MaterializedParentsHelper.getObjectId(parentObject),
                parents: (await MaterializedParentsHelper.findAllMaterializedParents(parent)).toString(),
                breadcrumbs: await MaterializedParentsHelper.createBreadcrumbs(parentObject),
            }
        );

        if (dbLatitude != -666) topic.p('latitude', dbLatitude);
        if (dbLongitude != -666) topic.p('longitude', dbLongitude);

        return new Promise( (resolve)=> {

            if (Object.keys(errorValidation).length !== 0 ){

                resolve({result: false, errors: errorValidation});
                return false;
            }

            topic.save(async function (err) {
                if (err) {
                    console.log("==> Error Saving Topic");
                    console.log(topic.errors); // the errors in validation

                    resolve({result:false, errors: topic.errors });
                } else {
                    console.log("Saving Topic Successfully");

                    await topic.keepURLSlug();
                    await VotingsHelper.initializeVoteInDB(topic.id, topic.p('parents'));
                    await TopicsSorter.initializeSorterInDB(topic.id, topic.p('dtCreation'));

                    if (arrAdditionalInfo.scrapped === true){ //it has been scrapped...

                    } else {
                        await topic.keepParentsStatistics(+1);

                        var SearchesHelper = require('../../../searches/helpers/Searches.helper.ts');
                        SearchesHelper.addTopicToSearch(null, topic); //async, but not awaited
                    }

                    //console.log(topic.getPublicInformation(userAuthenticated) );

                    resolve( {result:true, topic: topic.getPublicInformation(userAuthenticated) });
                }
            }.bind(this));

        });

    },


}

