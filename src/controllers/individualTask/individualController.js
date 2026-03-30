const { IndividualTask } = require("../../models");
const { sendResponse, HttpsStatus } = require("../../utils/response")

exports.createIndividualTask = async (req, res) => {
    try {
        const { title, description, deadline, priority, status } = req.body;
        const currentUserId = req.user.id;

        const errors = {};

        if(!title){
            errors.title = "title is required";
        }
        if(!description){
            errors.description = "description is required";
        }
        if(!deadline){
            errors.deadline = "deadline is required";
        }
        if(!priority){
            errors.priority = "priority is required";
        }
        if(!status){
            errors.status = "status is required";
        }

        if(Object.keys(errors).length > 0){
            return sendResponse(res, HttpsStatus.BAD_REQUEST, false, "Some fields are empty!", null, errors)
        }

        await IndividualTask.create({
            user_id: currentUserId,
            title,
            description,
            deadline,
            priority,
            status
        });

        return sendResponse(res, HttpsStatus.CREATED, true, "Task created successfully!");
    } catch (err) {
        return sendResponse(res, HttpsStatus.INTERNAL_SERVER_ERROR, false, "Server error!", null, { server: err.message })
    }
}

exports.getIndividualTasks = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    const tasks = await IndividualTask.findAll({
      where: {
        user_id: currentUserId
      },
      order: [['createdAt', 'DESC']] // latest first
    });

    return sendResponse(
      res,
      HttpsStatus.OK,
      true,
      "Tasks fetched successfully!",
      tasks
    );

  } catch (err) {
    return sendResponse(
      res,
      HttpsStatus.INTERNAL_SERVER_ERROR,
      false,
      "Server error!",
      null,
      { server: err.message }
    );
  }
};

exports.updateIndividualTaskStatus = async (req, res) => {
  try {
    const taskId = req.params.id;
    const { status } = req.body;
    const currentUserId = req.user.id;

    const errors = {};

    // Validate status
    const validStatuses = ['pending', 'in_progress', 'completed'];

    if (!status) {
      errors.status = "status is required";
    } else if (!validStatuses.includes(status)) {
      errors.status = "Invalid status value";
    }

    if (Object.keys(errors).length > 0) {
      return sendResponse(
        res,
        HttpsStatus.BAD_REQUEST,
        false,
        "Validation failed",
        null,
        errors
      );
    }

    // Find task
    const task = await IndividualTask.findOne({
      where: {
        id: taskId,
        user_id: currentUserId
      }
    });

    if (!task) {
      return sendResponse(
        res,
        HttpsStatus.NOT_FOUND,
        false,
        "Task not found!"
      );
    }

    // Update status
    task.status = status;
    await task.save();

    return sendResponse(
      res,
      HttpsStatus.OK,
      true,
      "Task status updated successfully!",
      task
    );

  } catch (err) {
    return sendResponse(
      res,
      HttpsStatus.INTERNAL_SERVER_ERROR,
      false,
      "Server error!",
      null,
      { server: err.message }
    );
  }
};