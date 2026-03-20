import { AllOnlineSongsIndexer } from "~/helpers/allOnlineSongsIndexer";

export default defineEventHandler(async () => {

	//startup indexes if not already done
	if (!AllOnlineSongsIndexer.checkIfIndexExists()) {
		throw createError({
			status: 500,
			message: "Online songs index file not found",
		});
	}

  const allOnlineSongInfos = AllOnlineSongsIndexer.getAllOnlineSongInfos();
  return {
    success: true,
    data: allOnlineSongInfos,
  };
});
