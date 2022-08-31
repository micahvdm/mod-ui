#include "patchstorage.h"

#include <cstdlib>
#include <cstdio>
#include <cstring>
#include <lilv/lilv.h>
#include <climits>
#include <errno.h>

static char* lilv_file_abspath(const char* const path)
{
    if (char* const lilvpath = lilv_file_uri_parse(path, nullptr))
    {
        char* ret = realpath(lilvpath, nullptr);
        lilv_free(lilvpath);
        return ret;
    }

    return nullptr;
}

static int patchstorage_parse_info(patchstorage_info_t *info, FILE *f)
{
    char key[128], value[128];
    key[127] = value[127] = '\0';
    while (fscanf(f, "%127[^=]=%127[^\n]%*c", key, value) == 2)
    {
        const char **d = nullptr;
        if (strncasecmp(key, "ID", 3) == 0)
            d = &info->id;
        else if (strncasecmp(key, "VERSION", 8) == 0)
            d = &info->version;

        if (d)
        {
            *d = strdup(value);
        }
    }

    if (!info->id || !info->version)
    {
        patchstorage_free_info(info);
        return -EINVAL;
    }

    return 0;
}

int patchstorage_read_info(patchstorage_info_t *info, const char *bundleuri)
{
    if (!info || !bundleuri)
        return -EINVAL;
    info->version = nullptr;
    info->id = nullptr;

    int result;
    char *bundlepath = lilv_file_abspath(bundleuri);
    char pspath[PATH_MAX+1];
    strncpy(pspath, bundlepath, PATH_MAX);
    free(bundlepath);
    if (strlen(pspath) <= PATH_MAX-13)
    {
        strcat(pspath, "/patchstorage");
        pspath[PATH_MAX] = '\0';

        FILE *f = fopen(pspath, "rt");
        if (f)
        {
            result = patchstorage_parse_info(info, f);
            fclose(f);
        }
        else
        {
            result = -EIO;
        }
    }

    return result;
}

void patchstorage_free_info(patchstorage_info_t *info)
{
    if (info->id) free((void*)info->id);
    if (info->version) free((void*)info->version);
    memset(info, 0, sizeof(*info));
}
