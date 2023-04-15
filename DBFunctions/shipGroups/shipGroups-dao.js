import shipGroupsModel from "./shipGroups-model.js";

export const findAllShipGroups = async () => await shipGroupsModel.find();

export const findShipGroupById = async (id) =>
  await shipGroupsModel.findById(id);

export const findShipGroupByTrackingNumber = async (trackingNumber) =>
  await shipGroupsModel.findOne({ trackingNumber });

export const createShipGroup = async (newShipGroup) =>
  await shipGroupsModel.create(newShipGroup);

export const deleteShipGroup = async (id) =>
  await shipGroupsModel.findByIdAndDelete({ _id: id });

export const updateShipGroup = async (id, newShipGroup) =>
  await shipGroupsModel.findByIdAndUpdate(
    { _id: id },
    { $set: newShipGroup },
    { new: true }
  );

export const countAllShipGroups = async () => {
  return { totalShipGroupsNumber: await shipGroupsModel.countDocuments({}) };
};

export const getShipmentRecentActivity = async () => {
  const dateLimit = new Date();
  dateLimit.setDate(dateLimit.getDate() - 7 * 7);
  const pipelineResult = await shipGroupsModel.aggregate([
    {
      $match: {
        $expr: {
          $and: [
            { $gte: ["$shipEndDate", dateLimit] },
            { $lte: ["$shipEndDate", new Date()] }
          ]
        }
      },
    },
    {
      $addFields: {
        weekAgo: {
          $floor: {
            $subtract: [
              { $divide: [{ $subtract: [new Date(), "$shipEndDate"] }, 86400000 * 7] },
              0
            ],
          },
        },
      },
    },
    {
      $group: {
        // must use `_id` to group and then project
        _id: { weekAgo: '$weekAgo', route: '$shipRoute' },
        count: { $sum: 1 }
      },
    },
    {
      $group: {
        // The second group stage
        _id: '$_id.weekAgo',
        routes: {
          $push: {
            route: '$_id.route',
            count: '$count',
          },
        },
      },
    },
    {
      $project: {
        "_id": 0,
        "weekAgo": "$_id",
        "routes": 1
      }
    },
    {
      $addFields: {
        mapFormat: {
          $arrayToObject: {
            $map: {
              input: '$routes',
              as: 'route',
              in: ['$$route.route', '$$route.count'],
            },
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        weekAgo: 1,
        mapFormat: 1
      }
    },


  ]);

  return {
    recentActivity: pipelineResult.reduce((acc, cur) => {
      acc[cur.weekAgo] = cur.mapFormat;
      return acc;
    }, {})
  }


};

export const getFiveLeadersWithMostShipments = async () => {
  const pipelineResult = await shipGroupsModel.aggregate([
    {
      $group: {
        _id: "$leader",
        amount: { $sum: 1 },
      },
    },
    { $sort: { amount: -1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "email",
        as: "user",
      },
    },
    { $unwind: "$user" },
    {
      $addFields: {
        name: "$user.name",
        avatar: "$user.avatar",
      },
    },
    {
      $project: {
        _id: 0,
        email: "$_id",
        avatar: 1,
        name: 1,
        amount: 1,
      },
    },
  ]);

  const topFiveLeaders = pipelineResult.map((leader, index) => {
    return {
      ...leader,
      rank: `Top ${index + 1}`
    }
  });

  return { topFiveLeaders: topFiveLeaders };
};


export const getFiveUsersWithMostShipments = async () => {
  const pipelineResult = await shipGroupsModel.aggregate([
    { $unwind: "$members" },
    {
      $group: {
        _id: "$members",
        amount: { $sum: 1 },
      },
    },
    { $sort: { amount: -1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "email",
        as: "user",
      },
    },
    { $unwind: "$user" },
    {
      $addFields: {
        name: "$user.name",
        avatar: "$user.avatar",
      },
    },
    {
      $project: {
        _id: 0,
        email: "$_id",
        avatar: 1,
        name: 1,
        amount: 1,
      },
    },
  ]);

  const topFiveUsers = pipelineResult.map((user, index) => {
    return {
      ...user,
      rank: `Top ${index + 1}`
    }
  })

  return { topFiveUsers: topFiveUsers };
};
