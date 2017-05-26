/**
 * Created by Alexandru Ionut Budisteanu - SkyHub on 5/26/2017.
 * (C) BIT TECHNOLOGIES
 */

var forumModel = require ('./../models/Forum.model.ts');
var commonFunctions = require ('../../../common/helpers/common-functions.helper.ts');

module.exports = {

    createDummyForum (iIndex)
    {
        return this.registerUser("emailDummy_"+iIndex+"@yahoo.com","userDummy_"+iIndex, "123456","Gigel",
            "Nume"+iIndex,"RO","Bucharest", "RO", "http://www.gravatar.com/avatar/ee4d1b570eff6ce63"+iIndex+"?default=wavatar&forcedefault=1",
            "http://www.hdfbcover.com/randomcovers/covers/never-stop-dreaming-quote-fb-cover.jpg");
    },

    findForumById (sId)
    {
        return new Promise( (resolve)=> {
                if ((typeof sId === 'undefined') || (sId == []) || (sId === null)) {
                    resolve(null);
                return null;
            }

            //console.log('finding user '+sId);

            var forum = redis.nohm.factory('ForumModel', sId, function (err) {
                if (err)  // db error or id not found
                    resolve (null);
                else
                    resolve (forum);
            });

        });
    },


    /*
     CREATING A NEW FORUM
     */
    addForum (UserAuthenticated, sTitle, sDescription, arrKeywords, sCountry, sCity, sLanguage, sIconPic, sCoverPic, dbLatitude, dbLongitude, iTimeZone){

        sCountry = sCountry || ''; sCity = sCity || ''; sIconPic = sIconPic || ''; sCoverPic = sCoverPic || '';
        dbLatitude = dbLatitude || -666; dbLongitude = dbLongitude || -666; iTimeZone = iTimeZone || 0;

        sLanguage = sLanguage || sCountry;

        var forum = redis.nohm.factory('ForumModel');
        var errorValidation = {};

        forum.p(
            {
                title: sTitle,
                URL: commonFunctions.url_slug(sTitle),
                description: sDescription,
                authorId: UserAuthenticated.getUserId(),
                keywords: commonFunctions.convertKeywordsArrayToString(arrKeywords),
                iconPic: sIconPic,
                coverPic: sCoverPic,
                country: sCountry.toLowerCase(),
                city: sCity.toLowerCase(),
                language: sLanguage.toLowerCase(),
                dtCreation: new Date(),
                dtLastActivity: new Date(),
                timeZone : iTimeZone,
            }
        );

        if (dbLatitude != -666) forum.p('latitude', dbLatitude);
        if (dbLongitude != -666) forum.p('longitude', dbLongitude);

        return new Promise( (resolve)=> {

            if (Object.keys(errorValidation).length !== 0 ){

                resolve({result: "false", errors: errorValidation});
                return false;
            }

            forum.save(function (err) {
                if (err) {
                    console.log("==> Error Saving Forum");
                    console.log(forum.errors); // the errors in validation

                    resolve({result:"false", errors: forum.errors });
                } else {
                    console.log("Saving Forum Successfully");
                    console.log(forum.getPrivateInformation());

                    resolve( {result:"true", forum: forum.getPrivateInformation() });
                }
            });

        });

    },



}

