/**
 * Created by Alexandru Ionut Budisteanu - SkyHub on 7/7/2017.
 * (C) BIT TECHNOLOGIES
 */

var mongoose = require('mongoose');

var UserModel = mongoose.model('users',{}, 'users');
var SiteCategoryModel = mongoose.model('SiteCategories',{ },'SiteCategories');
var ForumModel = mongoose.model('Forums',{ },'Forums');
var TopicsModel = mongoose.model('Topics',{ },'ForumTopics');

var UsersHelper = require ('../../REST/users/auth/helpers/Users.helper.ts');
var UserProperties = require ('../../REST/users/auth/models/User.properties.ts');
var SessionsHashList = require ('./../../REST/users/auth/sessions/helpers/SessionsHashList.helper.ts');

var ForumsHelper = require ('../../REST/forums/forums/helpers/Forums.helper.ts');
var TopicsHelper = require ('../../REST/forums/topics/helpers/Topics.helper.ts');
var ReplieHelper = require ('../../REST/forums/replies/helpers/Replies.helper.ts');
var VotingsHelper = require ('../../REST/Voting/helpers/Votings.helper.ts');

var newUsers = [];
var newCategories = [];
var newForums = [];
var newTopics = [];

class MongoImporter {

    async findUser(oldId){
        for (let i=0; i<newUsers.length; i++)
            if ((typeof newUsers[i] !== 'undefined')&&(typeof oldId !== 'undefined')&&(newUsers[i].oldId.toString() === oldId.toString()))
                return newUsers[i].user;

        return null;
    }

    async findCategory(oldId){
        for (let i=0; i<newCategories.length; i++)
            if ((typeof newCategories[i] !== 'undefined')&&(typeof oldId !== 'undefined')&&(newCategories[i].oldId.toString() === oldId.toString()))
                return newCategories[i].category;

        return null;
    }

    async findForum(oldId){
        for (let i=0; i<newForums.length; i++)
            if ((typeof newForums[i] !== 'undefined')&&(typeof oldId !== 'undefined')&&(newForums[i].oldId.toString() === oldId.toString()))
                return newForums[i].forum;

        return null;
    }

    async findTopic(oldId){
        for (let i=0; i<newTopics.length; i++)
            if ((typeof newTopics[i] !== 'undefined')&&(typeof oldId !== 'undefined')&&(newTopics[i].oldId.toString() === oldId.toString()))
                return newTopics[i].topic;

        return null;
    }

    async importUsers(){

        let users = await UserModel.find({});

        console.log(users.length);
        let count = 0;

        for (let i=0; i<users.length; i++){
            let user = users[i];

            //console.log(user);

            user = user._doc;

            // Object.keys(user).map(function(key, index) {
            //     console.log(key, user[key]);
            // });

            // console.log(1,user.City);
            // console.log(2, user['First Name']);

            let gender = UserProperties.UserGenderEnum.NOT_SPECIFIED;
            if (user.Gender === true) gender = UserProperties.UserGenderEnum.MALE;
            else gender = UserProperties.UserGenderEnum.FEMALE;

            let password = {};
            if ((typeof user.Password !== 'undefined')&&(user.Password.length > 5))
                password = {type:'string', value: user.Password};

            if ((typeof user['3rdPartiesSocialNet'] !== 'undefined')){
                password = {
                    type:'oauth2',
                    value:{
                        socialNetwork : user['3rdPartiesSocialNet'][0].Name,
                        socialNetworkUserId : user['3rdPartiesSocialNet'][0].Id,
                        socialNetworkData : {
                            name: user['3rdPartiesSocialNet'][0].Name,
                            link: user['3rdPartiesSocialNet'][0].Link,
                        },
                        accessToken : '@@@no token',
                    },
                }
            }


            if (typeof user.Username === 'undefined'){

                user.Username = user['First Name'] + '_' + user['Last Name'];
            }

            if (user.Username.length < 3){

                console.log('%$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$');
                console.log(user);

            }


            let newUser = await UsersHelper.registerUser(user.Email, user.Username, password, user['First Name'], user['Last Name'],
                                                        user.Country||'none', user.City||'none', '', user.AvatarPicture, '', user.latitude, user.longtitude, user.Biography, user.Age||0, user.TimeZone, gender, user.Verified);

            //console.log('##############', newUser);
            if (newUser.result === true){
                count++;
                newUsers.push({oldId: user._id, id: newUser.user.id, user: newUser.user});
                if ((typeof user.Credential !== 'undefined')&&(user.Credential.length > 3)){
                    SessionsHashList.addSession(newUser, user.Credential );
                }
            }

        }

        return (count);

    }

    async importSiteCategories(){

        let categories = await SiteCategoryModel.find({});

        //console.log('@@@ CATEGORIES',categories);

        let count = 0; let queue = [];
        for (let i=0; i<categories.length; i++){
            let category = categories[i]._doc;

            if ((typeof category.Parent === 'undefined')||(category.Parent === '')){
                queue.push(category);
            }

        }

        console.log("@@@@ CATEGORIES QUEUE", queue.length);

        let j = 0;
        while (j < queue.length ) {
            let category = queue[j];

            let user = await this.findUser(category.AuthorId);
            let parentCategory = await this.findCategory(category.Parent);

            if ((typeof user === "undefined")||(user === null))
                user = await newUsers[0].user;

            // console.log(user);
            // console.log(parentCategory);
            // console.log(category.Name);

            if ((typeof parentCategory !== 'undefined')&&(parentCategory !== null)&&(typeof parentCategory.id !== 'undefined')) parentCategory = parentCategory.id.toString();

            let answer = await ForumsHelper.addForum(user, parentCategory, category.Name, category.ShortDescription, category.Description, category.InputKeywords, user.country, user.city, '', category.Image, category.CoverImage, '', -666, -666 );

            if (answer.result === true){
                count++;
                newCategories.push({oldId: category._id, id: answer.forum.id, category: answer.forum});
            }

            for (let i=0; i<categories.length; i++){
                let category2 = categories[i]._doc;

                if ((typeof category2 !== 'undefined')&&(typeof category2.Parent !== 'undefined')&&(typeof category._id !== 'undefined')&&(category2.Parent.toString() === category._id.toString())){

                    queue.push(category2);
                }
            }

            j++;
        }


        return (count);

    }


    async importForums(){
        let forums = await ForumModel.find({});
        let count = 0;

        for (let i=0; i<forums.length; i++){
            let forum = forums[i]._doc;

            let user = await this.findUser(forum.AuthorId);
            let parentCategory = await this.findCategory(forum.ParentCategory);

            if ((typeof user === "undefined")||(user === null))
                user = await newUsers[0].user;

            if ((typeof parentCategory !== 'undefined')&&(parentCategory !== null)&&(typeof parentCategory.id !== 'undefined')) parentCategory = parentCategory.id.toString();
            else parentCategory = '';

            let newForum = await ForumsHelper.addForum(user, parentCategory, forum.Name, forum.Description, forum.DetailedDescription, forum.InputKeywords, user.Country||'none', user.City||'none', '', forum.Image, forum.CoverImage, '', user.latitude, user.longtitude);

            //console.log('##############', newUser);
            if (newForum.result === true){
                count++;
                newForums.push({oldId: forum._id, id: newForum.forum.id, forum: newForum.forum});
            }

        }

        return (count);
    }

    async importTopics(){
        let topics = await TopicsModel.find({});
        let count = 0;

        for (let i=0; i<topics.length; i++){
            let topic = topics[i]._doc;

            let user = await this.findUser(topic.AuthorId);
            let parentCategory = await this.findCategory(topic.ParentSiteCategoryId);
            let parentForum = await this.findForum(topic.ParentForumId);

            if ((typeof user === "undefined")||(user === null))
                user = await newUsers[0].user;

            if ((typeof parentCategory !== 'undefined')&&(parentCategory !== null)&&(typeof parentCategory.id !== 'undefined')) parentCategory = parentCategory.id.toString();
            else parentCategory = '';

            if ((typeof parentForum !== 'undefined')&&(parentForum !== null)&&(typeof parentForum.id !== 'undefined')) parentForum = parentForum.id.toString();
            else parentForum = '';

            if (parentForum === '') parentForum = parentCategory;


            //console.log('parents:', parentForum, parentCategory, typeof parentForum, typeof parentCategory);
            let newTopic = await TopicsHelper.addTopic(user, parentForum||parentCategory, topic.Title, topic.image, topic.BodyCode, [], topic.InputKeywords, user.Country||'none', user.City||'none', '', user.latitude, user.longtitude);

            if (newTopic.result === true){
                count++;
                newTopics.push({oldId: topic._id, id: newTopic.topic.id, topic: newTopic.topic});
            }

        }

        return (count);
    }

    async importReplies(){

    }

    async run(){

        console.log('running Mongo Importer');

        await mongoose.connect(constants.Mongo_connection_URI, { useMongoClient: true });

        let users = await this.importUsers();
        let siteCategories = await this.importSiteCategories();
        let forums = await this.importForums();
        let topics = await this.importTopics();
        let replies =  await this.importReplies();

        console.log('running Mongo Importer...');

        return({
            users: users,
            siteCategories: siteCategories,
            forums: forums,
            topics: topics,
            status: 'MERGE',
        });

    }
}

module.exports = new MongoImporter();