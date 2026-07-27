import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { AuthorizationGuard } from '../auth/guards/authorization.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Permission } from '../auth/permissions/permissions';
import { AuthUserView } from '../auth/types/auth-user.type';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { ListCategoriesQueryDto } from './dto/list-categories.query.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AuthorizationGuard)
@RequirePermissions(Permission.TOURNAMENT_MANAGE)
@Controller('tournaments/:tournamentId/categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @ApiOperation({ summary: 'List categories for a tournament' })
  list(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Query() query: ListCategoriesQueryDto,
  ) {
    return this.categoryService.list(tournamentId, query);
  }

  @Get(':categoryId')
  @ApiOperation({ summary: 'Get category by id' })
  getById(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ) {
    return this.categoryService.getById(tournamentId, categoryId);
  }

  @Post()
  @ApiOperation({ summary: 'Create category under a tournament (CAT-01/02)' })
  create(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Body() dto: CreateCategoryDto,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.categoryService.create(tournamentId, dto, user);
  }

  @Patch(':categoryId')
  @ApiOperation({ summary: 'Update category configuration (CAT-03/04)' })
  update(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.categoryService.update(tournamentId, categoryId, dto, user);
  }

  @Delete(':categoryId')
  @ApiOperation({
    summary: 'Soft delete category when no published artifacts (CAT-05)',
  })
  softDelete(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.categoryService.softDelete(tournamentId, categoryId, user);
  }
}
